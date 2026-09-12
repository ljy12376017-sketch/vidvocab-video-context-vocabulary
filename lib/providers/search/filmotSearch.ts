import type { SearchProvider, SearchVideoHit } from "@/lib/providers/types";

/** Stub — Filmot RapidAPI is not publicly available. */
export class FilmotSearchProvider implements SearchProvider {
  readonly id = "filmot-search";

  async search(_query: string, _limit: number): Promise<SearchVideoHit[]> {
    return [];
  }
}
