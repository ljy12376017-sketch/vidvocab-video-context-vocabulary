import { chatJson } from "@/lib/deepseek/client";
import type { ApiBudget } from "@/lib/guards/budgets";
import type { VideoClip } from "@/lib/types";

interface EnrichRaw {
  items: { id: string; summaryZh: string; contextZh: string }[];
}

/** Batch-generate clip summaries in one DeepSeek call when possible. */
export async function enrichClips(
  word: string,
  clips: Omit<VideoClip, "summaryZh" | "contextZh">[],
  budget: ApiBudget,
): Promise<VideoClip[]> {
  if (clips.length === 0) return [];

  if (!budget.canDeepseek()) {
    return clips.map((c) => ({
      ...c,
      summaryZh: `片段命中「${c.matchedText}」`,
      contextZh: `视频里出现了与「${word}」相关的台词。`,
    }));
  }

  budget.useDeepseek();

  const payload = clips.map((c) => ({
    id: c.id,
    title: c.title,
    matchedText: c.matchedText,
    matchedQuery: c.matchedQuery,
  }));

  try {
    const raw = await chatJson<EnrichRaw>(
      `你是趣味词汇教练。为每个视频片段写：summaryZh（一句话摘要）、contextZh（该词在片段中的使用背景，轻松口语）。
只返回 JSON：{"items":[{"id":"...","summaryZh":"...","contextZh":"..."}]}。中文，每条不超过 40 字。`,
      `单词：${word}\n片段：${JSON.stringify(payload)}`,
      { temperature: 0.5 },
    );

    const map = new Map(
      (raw.items || []).map((i) => [i.id, i] as const),
    );

    return clips.map((c) => {
      const hit = map.get(c.id);
      return {
        ...c,
        summaryZh: hit?.summaryZh || `片段命中「${c.matchedText}」`,
        contextZh:
          hit?.contextZh || `视频里出现了与「${word}」相关的台词。`,
      };
    });
  } catch {
    return clips.map((c) => ({
      ...c,
      summaryZh: `片段命中「${c.matchedText}」`,
      contextZh: `视频里出现了与「${word}」相关的台词。`,
    }));
  }
}
