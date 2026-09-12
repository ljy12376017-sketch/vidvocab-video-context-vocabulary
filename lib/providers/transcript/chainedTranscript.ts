import {
  classifyTranscriptFailure,
  sanitizeErrorSummary,
} from "@/lib/diagnostics/transcriptErrors";
import { logSafe } from "@/lib/diagnostics/safeLog";
import type { TranscriptCue, TranscriptProvider } from "@/lib/providers/types";

/**
 * Try primary (cloud) first, then fallback (local/scrape).
 * One composite call from the clip loop — budget counts once per video.
 */
export class ChainedTranscriptProvider implements TranscriptProvider {
  readonly id: string;

  constructor(
    private readonly primary: TranscriptProvider,
    private readonly fallback: TranscriptProvider,
  ) {
    this.id = `chain:${primary.id}>${fallback.id}`;
  }

  async fetchTranscript(
    videoId: string,
    langHints?: string[],
  ): Promise<TranscriptCue[]> {
    try {
      const cues = await this.primary.fetchTranscript(videoId, langHints);
      logSafe("info", "transcript", "PROVIDER_HIT", {
        provider: this.primary.id,
        chain: this.id,
        videoId,
        cues: cues.length,
      });
      return cues;
    } catch (primaryErr) {
      const primary = classifyTranscriptFailure(primaryErr, this.primary.id);
      logSafe("warn", "transcript", "PROVIDER_FALLBACK", {
        from: this.primary.id,
        to: this.fallback.id,
        videoId,
        httpStatus: primary.httpStatus ?? null,
        errorSummary: primary.errorSummary,
        failureCode: primary.code,
      });

      try {
        const cues = await this.fallback.fetchTranscript(videoId, langHints);
        logSafe("info", "transcript", "PROVIDER_HIT", {
          provider: this.fallback.id,
          chain: this.id,
          videoId,
          cues: cues.length,
        });
        return cues;
      } catch (fallbackErr) {
        const fb = classifyTranscriptFailure(fallbackErr, this.fallback.id);
        logSafe("warn", "transcript", fb.code, {
          provider: this.fallback.id,
          chain: this.id,
          videoId,
          httpStatus: fb.httpStatus ?? null,
          errorSummary: fb.errorSummary,
        });
        const err = fallbackErr as Error & {
          code?: string;
          httpStatus?: number;
          provider?: string;
        };
        err.code = fb.code;
        err.httpStatus = fb.httpStatus;
        err.provider = this.id;
        if (!err.message) {
          err.message = sanitizeErrorSummary(fallbackErr);
        }
        throw err;
      }
    }
  }
}
