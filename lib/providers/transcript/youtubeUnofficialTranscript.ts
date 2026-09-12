import { fetchTranscript } from "youtube-transcript";
import { youtubeFetch } from "@/lib/http/ensureProxy";
import { logSafe } from "@/lib/diagnostics/safeLog";
import {
  TranscriptFetchError,
  classifyTranscriptFailure,
  sanitizeErrorSummary,
} from "@/lib/diagnostics/transcriptErrors";
import type { TranscriptCue, TranscriptProvider } from "@/lib/providers/types";

/**
 * ONLY file allowed to import `youtube-transcript`.
 * Kept as fallback behind youtube-transcript.ai on Vercel.
 */
export class YoutubeUnofficialTranscriptProvider implements TranscriptProvider {
  readonly id = "youtube-unofficial";

  async fetchTranscript(
    videoId: string,
    langHints: string[] = ["en"],
  ): Promise<TranscriptCue[]> {
    const errors: ReturnType<typeof classifyTranscriptFailure>[] = [];
    const proxiedFetch = ((input: RequestInfo | URL, init?: RequestInit) =>
      youtubeFetch(
        typeof input === "string" || input instanceof URL
          ? input
          : input.url,
        init,
      )) as typeof fetch;

    for (const lang of [...langHints, undefined]) {
      try {
        const rows = await fetchTranscript(videoId, {
          ...(lang ? { lang } : {}),
          fetch: proxiedFetch,
        });
        logSafe("info", "transcript", "TRANSCRIPT_OK", {
          provider: this.id,
          videoId,
          cues: rows.length,
          lang: lang || "auto",
        });
        // youtube-transcript returns offset/duration in milliseconds
        return rows.map((r) => ({
          text: r.text,
          startSec: r.offset / 1000,
          durationSec: Math.max(r.duration / 1000, 0.1),
        }));
      } catch (e) {
        const classified = classifyTranscriptFailure(e, this.id);
        errors.push(classified);
        logSafe("warn", "transcript", classified.code, {
          provider: this.id,
          videoId,
          lang: lang || "auto",
          httpStatus: classified.httpStatus ?? null,
          errorSummary: classified.errorSummary,
        });
      }
    }

    const last = errors[errors.length - 1];
    throw new TranscriptFetchError(
      last?.errorSummary || sanitizeErrorSummary(`无法获取字幕 ${videoId}`),
      {
        code: last?.code || "TRANSCRIPT_UNAVAILABLE",
        provider: this.id,
        httpStatus: last?.httpStatus,
      },
    );
  }
}
