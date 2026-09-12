export interface SearchVideoHit {
  videoId: string;
  title: string;
  sourceUrl: string;
  channelTitle?: string;
}

export interface TranscriptCue {
  text: string;
  startSec: number;
  durationSec: number;
}

export interface RawClipCandidate {
  videoId: string;
  title: string;
  sourceUrl: string;
  source: "youtube" | "bilibili" | "archive" | "filmot";
  startSec: number;
  endSec: number;
  matchedText: string;
  matchedQuery: string;
}

export interface SearchProvider {
  readonly id: string;
  search(query: string, limit: number): Promise<SearchVideoHit[]>;
}

export interface TranscriptProvider {
  readonly id: string;
  fetchTranscript(
    videoId: string,
    langHints?: string[],
  ): Promise<TranscriptCue[]>;
}

export interface VideoClipProvider {
  readonly id: string;
  searchClips(query: string, limit: number): Promise<RawClipCandidate[]>;
  getDiagnostics?: () => import("@/lib/diagnostics/types").PipelineDiagnostics;
}
