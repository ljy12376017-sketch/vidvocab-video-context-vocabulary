import type { TranscriptCue, TranscriptProvider } from "@/lib/providers/types";

/** Stub for future Filmot caption/timestamp provider. */
export class FilmotCaptionProvider implements TranscriptProvider {
  readonly id = "filmot";

  async fetchTranscript(
    _videoId: string,
    _langHints?: string[],
  ): Promise<TranscriptCue[]> {
    return [];
  }
}
