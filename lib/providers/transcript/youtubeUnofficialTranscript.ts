import { fetchTranscript } from "youtube-transcript";
import { youtubeFetch } from "@/lib/http/ensureProxy";
import { classifyYoutubeError, logSafe } from "@/lib/diagnostics/safeLog";
import type { TranscriptCue, TranscriptProvider } from "@/lib/providers/types";

/**
 * ONLY file allowed to import `youtube-transcript`.
 * Swap via TRANSCRIPT_PROVIDER / registry without touching the loop.
 */
export class YoutubeUnofficialTranscriptProvider implements TranscriptProvider {
  readonly id = "youtube-unofficial";

  async fetchTranscript(
    videoId: string,
    langHints: string[] = ["en"],
  ): Promise<TranscriptCue[]> {
    const errors: string[] = [];
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
        const classified = classifyYoutubeError(e);
        errors.push(classified.code);
        logSafe("warn", "transcript", classified.code, { videoId });
      }
    }

    const last = errors.slice(-1)[0] || "TRANSCRIPT_UNAVAILABLE";
    const err = new Error(`无法获取字幕 ${videoId}`) as Error & {
      code?: string;
    };
    err.code = last;
    throw err;
  }
}
