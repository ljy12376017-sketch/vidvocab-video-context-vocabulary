import { classifyTranscriptFailure } from "@/lib/diagnostics/transcriptErrors";

type Level = "info" | "warn" | "error";

const SECRET_RE =
  /(AIza[0-9A-Za-z_-]{10,}|sk-[0-9A-Za-z_-]{10,}|eyJ[0-9A-Za-z_-]{20,}|Bearer\s+[^\s]+)/gi;

function scrub(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .replace(SECRET_RE, "[REDACTED]")
      .replace(/https?:\/\/[^\s)"']+/gi, "[URL]");
  }
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (
        /^(authorization|password|cookie)$/i.test(k) ||
        /(api[_-]?key|access[_-]?token|secret|proxyUrl|proxy_url|proxyurl)$/i.test(
          k,
        )
      ) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = scrub(v);
      }
    }
    return out;
  }
  return value;
}

/** Server-only structured log. Never prints API keys. */
export function logSafe(
  level: Level,
  scope: string,
  code: string,
  detail: Record<string, unknown> = {},
): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    scope,
    code,
    ...((scrub(detail) as Record<string, unknown>) || {}),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export function classifyYoutubeError(err: unknown): {
  code: string;
  userMessage: string;
} {
  if (
    (err as { name?: string })?.name === "TranscriptFetchError" ||
    (typeof (err as { code?: string })?.code === "string" &&
      String((err as { code: string }).code).startsWith("TRANSCRIPT_"))
  ) {
    const t = classifyTranscriptFailure(err);
    return { code: t.code, userMessage: t.userMessage };
  }

  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  if (
    lower.includes("connect timeout") ||
    lower.includes("und_err_connect_timeout") ||
    lower.includes("fetch failed")
  ) {
    return {
      code: "YOUTUBE_NETWORK_TIMEOUT",
      userMessage:
        "暂时连不上 YouTube / Google 服务。若你在使用代理，请确认本地代理已开启，或在环境变量设置 YOUTUBE_HTTPS_PROXY。",
    };
  }
  if (lower.includes("quota") || lower.includes("daily limit")) {
    return {
      code: "YOUTUBE_QUOTA_EXCEEDED",
      userMessage: "今日 YouTube 搜索配额已用尽，请稍后再试。",
    };
  }
  if (lower.includes("api key not valid") || lower.includes("keyinvalid")) {
    return {
      code: "YOUTUBE_KEY_INVALID",
      userMessage: "YouTube API Key 无效，请检查 .env.local 中的配置。",
    };
  }
  // Strict: only explicit “captions/subtitles disabled” wording
  if (
    /transcript is disabled|subtitles? are disabled|captions? (are )?disabled|captions? (have been )?turned off/i.test(
      msg,
    )
  ) {
    return {
      code: "TRANSCRIPT_DISABLED",
      userMessage: "已找到候选视频，但该视频关闭了字幕，正在尝试其他视频…",
    };
  }
  if (
    lower.includes("captcha") ||
    lower.includes("confirm you're not a bot") ||
    lower.includes("sign in to confirm") ||
    lower.includes("requestblocked") ||
    lower.includes("ipblocked")
  ) {
    return {
      code: "TRANSCRIPT_HTML_INTERSTITIAL",
      userMessage: "字幕源暂时拒绝访问该视频，正在尝试其他视频或备用字幕源…",
    };
  }
  if (
    lower.includes("not available") ||
    lower.includes("could not find") ||
    lower.includes("无法获取字幕")
  ) {
    return {
      code: "TRANSCRIPT_UNAVAILABLE",
      userMessage: "已找到候选视频，但该视频无可用字幕，正在尝试其他视频…",
    };
  }
  if (lower.includes("too many request") || lower.includes("rate limit")) {
    return {
      code: "TRANSCRIPT_RATE_LIMIT",
      userMessage: "字幕服务繁忙，正在放慢并尝试其他视频…",
    };
  }
  return {
    code: "YOUTUBE_UNKNOWN",
    userMessage: "视频检索遇到问题，正在尝试其他方式…",
  };
}
