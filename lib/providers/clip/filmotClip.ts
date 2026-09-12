import type { RawClipCandidate, VideoClipProvider } from "@/lib/providers/types";

/** Stub — activate when Filmot API access returns. */
export class FilmotClipProvider implements VideoClipProvider {
  readonly id = "filmot-clip";

  async searchClips(
    _query: string,
    _limit: number,
  ): Promise<RawClipCandidate[]> {
    return [];
  }
}
