import { NextResponse } from "next/server";
import { missingSecrets } from "@/lib/env";
import { clientIp, rateLimit } from "@/lib/guards/rateLimit";
import { readWordCache, writeWordCache } from "@/lib/cache/wordCache";
import { runClipSearchLoop } from "@/lib/loop/clipSearchLoop";
import { ensureYoutubeNetwork } from "@/lib/http/ensureProxy";
import { logSafe } from "@/lib/diagnostics/safeLog";
import type { ClipsResponse, WordDefinition } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  await ensureYoutubeNetwork();

  const ip = clientIp(req);
  const limited = rateLimit(`clips:${ip}`, 8, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      {
        error: `请求太频繁，请 ${limited.retryAfterSec}s 后再试`,
        code: "RATE_LIMITED",
      },
      { status: 429 },
    );
  }

  const missing = missingSecrets().filter(
    (s) => s.startsWith("DEEPSEEK") || s.startsWith("YOUTUBE"),
  );
  if (missing.length) {
    return NextResponse.json(
      {
        error: "服务端密钥未配置完整",
        code: "MISSING_SECRETS",
        placeholders: missing,
        hint: "请编辑 .env.local，替换所有 your_* 占位符后重启 npm run dev",
      },
      { status: 503 },
    );
  }

  let body: { definition?: WordDefinition; bypassCache?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "无效 JSON", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }

  const definition = body.definition;
  if (!definition?.word || !definition?.searchTerm) {
    return NextResponse.json(
      {
        error: "缺少 definition，请先调用 /api/define",
        code: "MISSING_DEFINITION",
      },
      { status: 400 },
    );
  }

  try {
    if (!body.bypassCache) {
      const cached = await readWordCache(definition.word);
      if (cached?.definition_json && (cached.clips_json?.length || 0) > 0) {
        const payload: ClipsResponse = {
          clips: cached.clips_json || [],
          matchMode: cached.match_mode,
          fallbackStory: cached.fallback_story,
          fromCache: true,
          notices: [
            ...(definition.usedEnglishForSearch
              ? [
                  `片段基于英文对应词「${definition.searchTerm}」检索（原词：${definition.word}）`,
                ]
              : []),
            ...(cached.match_mode === "synonym"
              ? ["以下片段为近义词/相关词的语境示例，非完全精确匹配"]
              : []),
          ],
          budget: { deepseekCalls: 0, transcriptCalls: 0, searchCalls: 0 },
        };
        return NextResponse.json(payload);
      }
      // Do not serve story-only cache as success — allow retry after network/proxy fix
    }

    const result = await runClipSearchLoop(definition);

    if (result.clips.length > 0 || result.fallbackStory) {
      await writeWordCache({
        word: definition.word,
        definition,
        clips: result.clips,
        fallbackStory: result.fallbackStory,
        matchMode: result.matchMode,
      });
    }

    logSafe("info", "api/clips", "RESPONSE", {
      word: definition.word,
      matchMode: result.matchMode,
      clips: result.clips.length,
      code: result.diagnostics?.primaryFailureCode,
    });

    return NextResponse.json(result);
  } catch (e) {
    logSafe("error", "api/clips", "UNHANDLED", {
      message: e instanceof Error ? e.message.slice(0, 160) : "unknown",
    });
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "片段检索失败",
        code: "CLIPS_UNHANDLED",
      },
      { status: 500 },
    );
  }
}
