export type MatchMode = "exact" | "synonym" | "story";

export type PartOfSpeech =
  | "noun"
  | "verb"
  | "adj"
  | "adv"
  | "phrase"
  | "other"
  | string;

export interface WordDefinition {
  word: string;
  language: string;
  meaningsZh: string[];
  partOfSpeech: PartOfSpeech[];
  examples: { sentence: string; translationZh: string }[];
  englishEquivalent: string | null;
  usedEnglishForSearch: boolean;
  searchTerm: string;
}

export interface VideoClip {
  id: string;
  source: "youtube" | "bilibili" | "archive" | "filmot";
  videoId: string;
  title: string;
  startSec: number;
  endSec: number;
  durationSec: number;
  embedUrl: string;
  sourceUrl: string;
  matchedText: string;
  matchedQuery: string;
  summaryZh: string;
  contextZh: string;
  isSynonymMatch: boolean;
}

export interface FallbackStory {
  titleZh: string;
  bodyZh: string;
}

export interface DefineResponse {
  definition: WordDefinition;
  fromCache: boolean;
  notice?: string;
}

export interface ClipsResponse {
  clips: VideoClip[];
  matchMode: MatchMode;
  fallbackStory: FallbackStory | null;
  fromCache: boolean;
  notices: string[];
  budget: {
    deepseekCalls: number;
    transcriptCalls: number;
    searchCalls: number;
  };
  diagnostics?: import("@/lib/diagnostics/types").PipelineDiagnostics;
}

export interface WordCacheRow {
  word_normalized: string;
  lang_hint: string;
  definition_json: WordDefinition;
  clips_json: VideoClip[] | null;
  fallback_story: FallbackStory | null;
  match_mode: MatchMode;
  created_at: string;
  expires_at: string;
}
