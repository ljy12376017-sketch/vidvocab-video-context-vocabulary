import { enrichClips } from "@/lib/deepseek/summarizeClip";
import { generateFallbackStory } from "@/lib/deepseek/storyFallback";
import { suggestSynonyms } from "@/lib/deepseek/synonyms";
import { ApiBudget, BUDGETS } from "@/lib/guards/budgets";
import { createClipProviders } from "@/lib/providers/registry";
import type { RawClipCandidate } from "@/lib/providers/types";
import type {
  ClipsResponse,
  FallbackStory,
  MatchMode,
  VideoClip,
  WordDefinition,
} from "@/lib/types";
import {
  emptyDiagnostics,
  type PipelineDiagnostics,
} from "@/lib/diagnostics/types";
import { ensureYoutubeNetwork } from "@/lib/http/ensureProxy";
import { logSafe } from "@/lib/diagnostics/safeLog";

function toEmbedUrl(videoId: string, start: number, end: number): string {
  const startSec = Math.max(0, Math.floor(start));
  const endSec = Math.max(startSec + 1, Math.ceil(end));
  const params = new URLSearchParams({
    start: String(startSec),
    end: String(endSec),
    rel: "0",
    modestbranding: "1",
  });
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

function isValidClip(c: VideoClip): boolean {
  const dur = c.endSec - c.startSec;
  return Boolean(
    c.videoId &&
      c.embedUrl &&
      c.sourceUrl &&
      c.summaryZh &&
      c.contextZh &&
      Number.isFinite(c.startSec) &&
      Number.isFinite(c.endSec) &&
      dur >= BUDGETS.minClipSec &&
      dur <= BUDGETS.maxClipSec,
  );
}

function dedupe(raw: RawClipCandidate[]): RawClipCandidate[] {
  const seen = new Set<string>();
  const out: RawClipCandidate[] = [];
  for (const c of raw) {
    const key = `${c.videoId}:${c.startSec}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

function mergeDiag(
  into: PipelineDiagnostics,
  from?: PipelineDiagnostics,
): void {
  if (!from) return;
  into.networkMode = from.networkMode;
  into.proxyHost = from.proxyHost;
  into.searchCalls += from.searchCalls;
  into.candidatesTried += from.candidatesTried;
  into.transcriptsOk += from.transcriptsOk;
  into.matchedClips += from.matchedClips;
  into.candidates.push(...from.candidates);
  for (const n of from.progressNotices) {
    if (!into.progressNotices.includes(n)) into.progressNotices.push(n);
  }
  if (
    into.primaryFailureCode === "OK" &&
    from.primaryFailureCode !== "OK"
  ) {
    into.primaryFailureCode = from.primaryFailureCode;
  }
}

async function collectFromProviders(
  query: string,
  budget: ApiBudget,
  need: number,
  diag: PipelineDiagnostics,
): Promise<RawClipCandidate[]> {
  const providers = createClipProviders(budget);
  const found: RawClipCandidate[] = [];

  for (const provider of providers) {
    if (found.length >= need) break;
    try {
      const batch = await provider.searchClips(query, need - found.length + 2);
      found.push(...batch);
      mergeDiag(diag, provider.getDiagnostics?.());
    } catch (e) {
      logSafe("warn", "loop", "PROVIDER_THROW", {
        provider: provider.id,
        message: e instanceof Error ? e.message.slice(0, 120) : "unknown",
      });
      mergeDiag(diag, provider.getDiagnostics?.());
    }
  }

  return dedupe(found).slice(0, BUDGETS.maxClips);
}

export async function runClipSearchLoop(
  definition: WordDefinition,
): Promise<ClipsResponse> {
  await ensureYoutubeNetwork();
  const budget = new ApiBudget();
  const notices: string[] = [];
  const diagnostics = emptyDiagnostics();
  const searchTerm = definition.searchTerm;

  if (definition.usedEnglishForSearch) {
    notices.push(
      `片段基于英文对应词「${searchTerm}」检索（原词：${definition.word}）`,
    );
  }

  let matchMode: MatchMode = "exact";
  let raw = await collectFromProviders(
    searchTerm,
    budget,
    BUDGETS.targetClips,
    diagnostics,
  );

  if (raw.length < BUDGETS.targetClips) {
    const synonyms = await suggestSynonyms(searchTerm, budget);
    if (synonyms.length && raw.length === 0) {
      notices.push(`精确匹配暂无结果，正在用近义词试试：${synonyms.join("、")}`);
    }
    for (const syn of synonyms) {
      if (raw.length >= BUDGETS.targetClips) break;
      const more = await collectFromProviders(
        syn,
        budget,
        BUDGETS.targetClips - raw.length,
        diagnostics,
      );
      raw = dedupe([...raw, ...more]);
    }
    if (raw.length > 0 && raw.some((c) => c.matchedQuery !== searchTerm)) {
      matchMode = "synonym";
      notices.push("以下片段为近义词/相关词的语境示例，非完全精确匹配");
    }
  }

  let clips: VideoClip[] = [];
  let fallbackStory: FallbackStory | null = null;

  if (raw.length === 0) {
    matchMode = "story";
    notices.push(...diagnostics.progressNotices.slice(0, 3));
    notices.push("暂无视频片段素材，以下为 AI 生成的情境示例");
    fallbackStory = await generateFallbackStory(
      definition.word,
      definition.meaningsZh.join("；"),
      budget,
    );
    if (diagnostics.primaryFailureCode === "OK") {
      diagnostics.primaryFailureCode = "ALL_CANDIDATES_FAILED";
    }
  } else {
    const partial = raw.slice(0, BUDGETS.maxClips).map((c, idx) => ({
      id: `${c.videoId}-${c.startSec}-${idx}`,
      source: c.source,
      videoId: c.videoId,
      title: c.title,
      startSec: c.startSec,
      endSec: c.endSec,
      durationSec: c.endSec - c.startSec,
      embedUrl: toEmbedUrl(c.videoId, c.startSec, c.endSec),
      sourceUrl: `https://www.youtube.com/watch?v=${c.videoId}&t=${Math.floor(c.startSec)}s`,
      matchedText: c.matchedText,
      matchedQuery: c.matchedQuery,
      isSynonymMatch:
        c.matchedQuery.toLowerCase() !== searchTerm.toLowerCase(),
    }));

    clips = (await enrichClips(definition.word, partial, budget)).filter(
      isValidClip,
    );
    diagnostics.matchedClips = clips.length;

    if (clips.length === 0) {
      matchMode = "story";
      notices.push("候选片段校验未通过，改为展示 AI 情境示例");
      fallbackStory = await generateFallbackStory(
        definition.word,
        definition.meaningsZh.join("；"),
        budget,
      );
      diagnostics.primaryFailureCode = "CLIP_WINDOW_INVALID";
    } else {
      diagnostics.primaryFailureCode = "OK";
      notices.push(...diagnostics.progressNotices.slice(0, 2));
    }
  }

  logSafe("info", "loop", "LOOP_DONE", {
    word: definition.word,
    matchMode,
    clips: clips.length,
    primary: diagnostics.primaryFailureCode,
    network: diagnostics.networkMode,
  });

  return {
    clips,
    matchMode,
    fallbackStory,
    fromCache: false,
    notices: [...new Set(notices)],
    budget: budget.snapshot(),
    diagnostics,
  };
}
