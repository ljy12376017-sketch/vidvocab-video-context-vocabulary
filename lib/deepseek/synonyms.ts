import { chatJson } from "@/lib/deepseek/client";
import type { ApiBudget } from "@/lib/guards/budgets";
import { BUDGETS } from "@/lib/guards/budgets";

export async function suggestSynonyms(
  word: string,
  budget: ApiBudget,
): Promise<string[]> {
  if (!budget.canDeepseek()) return [];
  budget.useDeepseek();

  const raw = await chatJson<{ synonyms: string[] }>(
    `为英语检索降级生成近义词/同词根词。只返回 JSON：{"synonyms":["..."]}，最多 ${BUDGETS.maxSynonyms} 个，优先常见英语词。`,
    `目标词：${word}`,
    { temperature: 0.3 },
  );

  return (raw.synonyms || [])
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, BUDGETS.maxSynonyms);
}
