import {
  TranscriptFetchError,
  sanitizeErrorSummary,
} from "@/lib/diagnostics/transcriptErrors";
import { logSafe } from "@/lib/diagnostics/safeLog";
import type { TranscriptCue, TranscriptProvider } from "@/lib/providers/types";

const BASE = "https://youtube-transcript.ai/transcript";
const MIN_INTERVAL_MS = 900;
let lastRequestAt = 0;
/** Process-level circuit: after fair-use throttle, skip primary for a short cool-down. */
let rateLimitedUntil = 0;

/**
 * Cloud-friendly transcript source (no API key).
 * Uses youtube-transcript.ai fair-use public endpoint — preferred on Vercel direct.
 */
export class YoutubeTranscriptAiProvider implements TranscriptProvider {
  readonly id = "youtube-transcript-ai";

  async fetchTranscript(
    videoId: string,
    langHints: string[] = ["en"],
  ): Promise<TranscriptCue[]> {
    if (Date.now() < rateLimitedUntil) {
      throw new TranscriptFetchError("fair-use cool-down active", {
        code: "TRANSCRIPT_RATE_LIMIT",
        provider: this.id,
      });
    }

    const langs = expandLangHints(langHints);
    const errors: TranscriptFetchError[] = [];

    for (const lang of langs) {
      try {
        const cues = await this.fetchLang(videoId, lang);
        logSafe("info", "transcript", "TRANSCRIPT_OK", {
          provider: this.id,
          videoId,
          lang,
          cues: cues.length,
        });
        return cues;
      } catch (e) {
        if (e instanceof TranscriptFetchError) {
          errors.push(e);
          logSafe("warn", "transcript", e.code, {
            provider: this.id,
            videoId,
            lang,
            httpStatus: e.httpStatus ?? null,
            errorSummary: sanitizeErrorSummary(e),
          });
          if (
            e.code === "TRANSCRIPT_RATE_LIMIT" ||
            e.code === "TRANSCRIPT_HTTP_403" ||
            e.code === "TRANSCRIPT_HTTP_429"
          ) {
            rateLimitedUntil = Date.now() + 60_000;
            break;
          }
        } else {
          const wrapped = new TranscriptFetchError(
            sanitizeErrorSummary(e) || "provider exception",
            {
              code: "TRANSCRIPT_PROVIDER_ERROR",
              provider: this.id,
              cause: e,
            },
          );
          errors.push(wrapped);
          logSafe("warn", "transcript", wrapped.code, {
            provider: this.id,
            videoId,
            lang,
            errorSummary: sanitizeErrorSummary(e),
          });
        }
      }
    }

    throw (
      errors[errors.length - 1] ||
      new TranscriptFetchError(`无法获取字幕 ${videoId}`, {
        code: "TRANSCRIPT_UNAVAILABLE",
        provider: this.id,
      })
    );
  }

  private async fetchLang(
    videoId: string,
    lang: string,
  ): Promise<TranscriptCue[]> {
    await paceRequests();
    const url = `${BASE}/${encodeURIComponent(videoId)}.txt?lang=${encodeURIComponent(lang)}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "text/plain, text/markdown, */*",
          "User-Agent": "VidVocab/1.0 (+transcript)",
        },
        signal: AbortSignal.timeout(20000),
        redirect: "follow",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message.toLowerCase() : "";
      const code =
        msg.includes("timeout") || msg.includes("aborted")
          ? "TRANSCRIPT_TIMEOUT"
          : "TRANSCRIPT_NETWORK";
      throw new TranscriptFetchError(sanitizeErrorSummary(e) || code, {
        code,
        provider: this.id,
        cause: e,
      });
    }

    const body = await res.text();
    const contentType = (res.headers.get("content-type") || "").toLowerCase();

    if (!res.ok) {
      const code =
        res.status === 429
          ? "TRANSCRIPT_RATE_LIMIT"
          : res.status === 403
            ? "TRANSCRIPT_HTTP_403"
            : res.status === 404
              ? "TRANSCRIPT_UNAVAILABLE"
              : "TRANSCRIPT_PROVIDER_ERROR";
      throw new TranscriptFetchError(
        `transcript.ai HTTP ${res.status}`,
        { code, provider: this.id, httpStatus: res.status },
      );
    }

    if (
      contentType.includes("text/html") ||
      looksLikeHtmlInterstitial(body)
    ) {
      throw new TranscriptFetchError("HTML interstitial instead of transcript", {
        code: "TRANSCRIPT_HTML_INTERSTITIAL",
        provider: this.id,
        httpStatus: res.status,
      });
    }

    if (looksLikeFairUseThrottle(body)) {
      throw new TranscriptFetchError("fair-use rate limit message", {
        code: "TRANSCRIPT_RATE_LIMIT",
        provider: this.id,
        httpStatus: res.status,
      });
    }

    if (!body.trim()) {
      throw new TranscriptFetchError("empty response", {
        code: "TRANSCRIPT_EMPTY",
        provider: this.id,
        httpStatus: res.status,
      });
    }

    const cues = parseTranscriptAiMarkdown(body);
    if (cues.length === 0) {
      throw new TranscriptFetchError("no cues parsed", {
        code: "TRANSCRIPT_EMPTY",
        provider: this.id,
        httpStatus: res.status,
      });
    }
    return cues;
  }
}

async function paceRequests(): Promise<void> {
  const now = Date.now();
  const wait = lastRequestAt + MIN_INTERVAL_MS - now;
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  lastRequestAt = Date.now();
}

function expandLangHints(langHints: string[]): string[] {
  const out: string[] = [];
  const push = (l: string) => {
    if (!out.includes(l)) out.push(l);
  };
  for (const hint of langHints.length ? langHints : ["en"]) {
    const h = hint.toLowerCase();
    if (h === "en" || h.startsWith("en-")) {
      push("en");
      push("a-en"); // English auto-generated
    } else if (h === "a-en" || h.includes("auto")) {
      push("a-en");
      push("en");
    } else {
      push(hint);
    }
  }
  return out;
}

function looksLikeHtmlInterstitial(body: string): boolean {
  const head = body.slice(0, 400).toLowerCase();
  return (
    head.includes("<!doctype html") ||
    head.includes("<html") ||
    head.includes("captcha") ||
    head.includes("confirm you") ||
    head.includes("sign in to confirm")
  );
}

function looksLikeFairUseThrottle(body: string): boolean {
  const lower = body.toLowerCase();
  return (
    lower.includes("high volume") ||
    lower.includes("rate limit") ||
    lower.includes("commercial / partnership") ||
    lower.includes("we'd love to support it properly")
  );
}

/** Parse youtube-transcript.ai Markdown: lines like `[m:ss] text` or `[h:mm:ss] text`. */
export function parseTranscriptAiMarkdown(body: string): TranscriptCue[] {
  const lines = body.split(/\r?\n/);
  const raw: { startSec: number; text: string }[] = [];

  for (const line of lines) {
    const m = line.match(
      /^\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*(.*)$/,
    );
    if (!m) continue;
    const startSec = parseClock(m[1]);
    const text = decodeEntities(m[2] || "")
      .replace(/♪/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;
    raw.push({ startSec, text });
  }

  if (raw.length === 0) return [];

  const cues: TranscriptCue[] = [];
  for (let i = 0; i < raw.length; i++) {
    const start = raw[i].startSec;
    const next = raw[i + 1]?.startSec;
    const durationSec =
      next !== undefined
        ? Math.max(next - start, 0.5)
        : Math.max(8, Math.min(28, raw[i].text.split(/\s+/).length * 0.35));
    cues.push({
      text: raw[i].text,
      startSec: start,
      durationSec,
    });
  }
  return cues;
}

function parseClock(clock: string): number {
  const parts = clock.split(":").map((p) => Number(p));
  if (parts.some((n) => Number.isNaN(n))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\[\s*__\s*\]/g, " ");
}
