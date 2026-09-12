import { chatJson } from "@/lib/deepseek/client";
import type { WordDefinition } from "@/lib/types";
import type { ApiBudget } from "@/lib/guards/budgets";

interface DefineRaw {
  word: string;
  language: string;
  meaningsZh: string[];
  partOfSpeech: string[];
  examples: { sentence: string; translationZh: string }[];
  englishEquivalent: string | null;
  isEnglish: boolean;
}

function looksLikeLatinWord(word: string): boolean {
  return /^[a-zA-Z][a-zA-Z\-'\s]*$/.test(word.trim());
}

export async function defineWord(
  word: string,
  budget: ApiBudget,
): Promise<WordDefinition> {
  budget.useDeepseek();

  const raw = await chatJson<DefineRaw>(
    `你是轻松幽默的多语言词汇教练。只返回 JSON，字段：
word, language(ISO如en/ja/ru/zh), meaningsZh(中文释义数组1-3个),
partOfSpeech(数组), examples(1-2个，含 sentence 与 translationZh),
englishEquivalent(若原词不是英语则给最常用英文对应词，否则 null),
isEnglish(boolean)。语气准确，不要编造冷僻义项。`,
    `请解释这个词/短语：${word}`,
  );

  const isEnglish =
    typeof raw.isEnglish === "boolean"
      ? raw.isEnglish
      : looksLikeLatinWord(word) && (raw.language || "en").startsWith("en");

  const englishEquivalent = isEnglish
    ? null
    : raw.englishEquivalent?.trim() || null;

  const searchTerm = (englishEquivalent || word).trim();
  const usedEnglishForSearch = Boolean(englishEquivalent) && !isEnglish;

  return {
    word: raw.word || word,
    language: raw.language || (isEnglish ? "en" : "und"),
    meaningsZh: raw.meaningsZh?.length ? raw.meaningsZh : ["（暂无释义）"],
    partOfSpeech: raw.partOfSpeech?.length ? raw.partOfSpeech : ["other"],
    examples: (raw.examples || []).slice(0, 2),
    englishEquivalent,
    usedEnglishForSearch,
    searchTerm,
  };
}
