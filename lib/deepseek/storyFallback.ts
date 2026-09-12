import { chatJson } from "@/lib/deepseek/client";
import type { ApiBudget } from "@/lib/guards/budgets";
import type { FallbackStory } from "@/lib/types";

export async function generateFallbackStory(
  word: string,
  definitionHint: string,
  budget: ApiBudget,
): Promise<FallbackStory> {
  if (!budget.canDeepseek()) {
    return {
      titleZh: `关于「${word}」的小场景`,
      bodyZh: `想象你和朋友聊天时，自然用到了「${word}」（${definitionHint}）。虽然暂时没有合适的视频片段，但把词放进真实对话里记会更牢。`,
    };
  }

  budget.useDeepseek();

  const raw = await chatJson<FallbackStory>(
    `用轻松搞笑语气写一段 100-150 字中文情境短文/小对话，自然嵌入目标词。
只返回 JSON：{"titleZh":"...","bodyZh":"..."}。明确是虚构示例。`,
    `单词：${word}\n释义提示：${definitionHint}`,
    { temperature: 0.7 },
  );

  return {
    titleZh: raw.titleZh || `关于「${word}」的小场景`,
    bodyZh: raw.bodyZh || "",
  };
}
