import type { PipelineErrorCode } from "@/lib/diagnostics/types";

const SECRET_RE =
  /(AIza[0-9A-Za-z_-]{10,}|sk-[0-9A-Za-z_-]{10,}|eyJ[0-9A-Za-z_-]{20,}|Bearer\s+\S+|Cookie:\s*[^\s;]+)/gi;

export type TranscriptFailureCode =
  | "TRANSCRIPT_DISABLED"
  | "TRANSCRIPT_UNAVAILABLE"
  | "TRANSCRIPT_RATE_LIMIT"
  | "TRANSCRIPT_HTTP_403"
  | "TRANSCRIPT_HTTP_429"
  | "TRANSCRIPT_TIMEOUT"
  | "TRANSCRIPT_HTML_INTERSTITIAL"
  | "TRANSCRIPT_EMPTY"
  | "TRANSCRIPT_NETWORK"
  | "TRANSCRIPT_PROVIDER_ERROR";

export class TranscriptFetchError extends Error {
  readonly code: TranscriptFailureCode;
  readonly httpStatus?: number;
  readonly provider: string;

  constructor(
    message: string,
    opts: {
      code: TranscriptFailureCode;
      provider: string;
      httpStatus?: number;
      cause?: unknown;
    },
  ) {
    super(message, opts.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = "TranscriptFetchError";
    this.code = opts.code;
    this.provider = opts.provider;
    this.httpStatus = opts.httpStatus;
  }
}

export function sanitizeErrorSummary(err: unknown, maxLen = 160): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : String(err);
  return raw
    .replace(SECRET_RE, "[REDACTED]")
    .replace(/https?:\/\/[^\s)"']+/gi, "[URL]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

/** Strict classification — TRANSCRIPT_DISABLED only for explicit “captions/subtitles closed” signals. */
export function classifyTranscriptFailure(
  err: unknown,
  fallbackProvider = "unknown",
): {
  code: TranscriptFailureCode;
  userMessage: string;
  httpStatus?: number;
  provider: string;
  errorSummary: string;
} {
  if (err instanceof TranscriptFetchError) {
    return {
      code: err.code,
      userMessage: userMessageFor(err.code),
      httpStatus: err.httpStatus,
      provider: err.provider,
      errorSummary: sanitizeErrorSummary(err),
    };
  }

  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  const httpStatus = extractHttpStatus(err, msg);
  const provider =
    typeof (err as { provider?: string })?.provider === "string"
      ? (err as { provider: string }).provider
      : fallbackProvider;

  let code: TranscriptFailureCode = "TRANSCRIPT_PROVIDER_ERROR";

  if (
    /transcript is disabled|subtitles? are disabled|captions? (are )?disabled|captions? (have been )?turned off/i.test(
      msg,
    )
  ) {
    code = "TRANSCRIPT_DISABLED";
  } else if (
    httpStatus === 429 ||
    lower.includes("too many request") ||
    lower.includes("rate limit")
  ) {
    code = "TRANSCRIPT_RATE_LIMIT";
  } else if (httpStatus === 403) {
    code = "TRANSCRIPT_HTTP_403";
  } else if (
    lower.includes("captcha") ||
    lower.includes("confirm you're not a bot") ||
    lower.includes("sign in to confirm") ||
    lower.includes("html interstitial") ||
    lower.includes("requestblocked") ||
    lower.includes("ipblocked") ||
    lower.includes("sorry for the interruption")
  ) {
    code = "TRANSCRIPT_HTML_INTERSTITIAL";
  } else if (
    lower.includes("timeout") ||
    lower.includes("aborted") ||
    lower.includes("und_err_connect_timeout")
  ) {
    code = "TRANSCRIPT_TIMEOUT";
  } else if (
    lower.includes("fetch failed") ||
    lower.includes("econnrefused") ||
    lower.includes("enotfound") ||
    lower.includes("network") ||
    lower.includes("socket")
  ) {
    code = "TRANSCRIPT_NETWORK";
  } else if (
    lower.includes("empty transcript") ||
    lower.includes("no cues") ||
    lower.includes("empty response")
  ) {
    code = "TRANSCRIPT_EMPTY";
  } else if (
    lower.includes("not available") ||
    lower.includes("could not find") ||
    lower.includes("no transcripts are available") ||
    lower.includes("无法获取字幕")
  ) {
    code = "TRANSCRIPT_UNAVAILABLE";
  } else if (httpStatus !== undefined && httpStatus >= 400) {
    code =
      httpStatus === 429
        ? "TRANSCRIPT_RATE_LIMIT"
        : httpStatus === 403
          ? "TRANSCRIPT_HTTP_403"
          : "TRANSCRIPT_PROVIDER_ERROR";
  }

  return {
    code,
    userMessage: userMessageFor(code),
    httpStatus,
    provider,
    errorSummary: sanitizeErrorSummary(err),
  };
}

export function asPipelineCode(
  code: TranscriptFailureCode,
): PipelineErrorCode {
  return code;
}

function userMessageFor(code: TranscriptFailureCode): string {
  switch (code) {
    case "TRANSCRIPT_DISABLED":
      return "已找到候选视频，但该视频关闭了字幕，正在尝试其他视频…";
    case "TRANSCRIPT_UNAVAILABLE":
    case "TRANSCRIPT_EMPTY":
      return "已找到候选视频，但该视频无可用英文字幕，正在尝试其他视频…";
    case "TRANSCRIPT_RATE_LIMIT":
    case "TRANSCRIPT_HTTP_429":
      return "字幕服务繁忙，正在放慢并尝试其他视频…";
    case "TRANSCRIPT_HTTP_403":
    case "TRANSCRIPT_HTML_INTERSTITIAL":
      return "字幕源暂时拒绝访问该视频，正在尝试其他视频或备用字幕源…";
    case "TRANSCRIPT_TIMEOUT":
    case "TRANSCRIPT_NETWORK":
      return "拉取字幕时网络异常，正在尝试其他视频…";
    default:
      return "字幕抓取遇到问题，正在尝试其他视频或备用字幕源…";
  }
}

function extractHttpStatus(err: unknown, message: string): number | undefined {
  const fromProp = (err as { httpStatus?: unknown; status?: unknown }) || {};
  if (typeof fromProp.httpStatus === "number") return fromProp.httpStatus;
  if (typeof fromProp.status === "number") return fromProp.status;
  const m = message.match(/\b([45]\d{2})\b/);
  if (m) return Number(m[1]);
  return undefined;
}
