export type PipelineErrorCode =
  | "OK"
  | "YOUTUBE_NETWORK_TIMEOUT"
  | "YOUTUBE_KEY_INVALID"
  | "YOUTUBE_QUOTA_EXCEEDED"
  | "YOUTUBE_SEARCH_EMPTY"
  | "YOUTUBE_SEARCH_FAILED"
  | "TRANSCRIPT_DISABLED"
  | "TRANSCRIPT_UNAVAILABLE"
  | "TRANSCRIPT_RATE_LIMIT"
  | "NO_WORD_MATCH_IN_CAPTIONS"
  | "CLIP_WINDOW_INVALID"
  | "EMBED_FORBIDDEN"
  | "ALL_CANDIDATES_FAILED"
  | "PROXY_REQUIRED"
  | "YOUTUBE_UNKNOWN";

export interface CandidateDiag {
  videoId: string;
  title: string;
  status:
    | "matched"
    | "no_transcript"
    | "transcript_disabled"
    | "no_word_match"
    | "bad_window"
    | "embed_forbidden"
    | "error";
  code: PipelineErrorCode;
  detail?: string;
}

export interface PipelineDiagnostics {
  networkMode: "env" | "auto" | "direct" | "none";
  proxyHost: string | null;
  searchCalls: number;
  candidatesTried: number;
  transcriptsOk: number;
  matchedClips: number;
  primaryFailureCode: PipelineErrorCode;
  candidates: CandidateDiag[];
  progressNotices: string[];
}

export function emptyDiagnostics(): PipelineDiagnostics {
  return {
    networkMode: "none",
    proxyHost: null,
    searchCalls: 0,
    candidatesTried: 0,
    transcriptsOk: 0,
    matchedClips: 0,
    primaryFailureCode: "OK",
    candidates: [],
    progressNotices: [],
  };
}
