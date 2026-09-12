import { YoutubeDataApiSearchProvider } from "@/lib/providers/search/youtubeDataApiSearch";
import { FilmotSearchProvider } from "@/lib/providers/search/filmotSearch";
import { YoutubeUnofficialTranscriptProvider } from "@/lib/providers/transcript/youtubeUnofficialTranscript";
import { FilmotCaptionProvider } from "@/lib/providers/transcript/filmotCaption";
import { YoutubeCompositeClipProvider } from "@/lib/providers/clip/youtubeComposite";
import { FilmotClipProvider } from "@/lib/providers/clip/filmotClip";
import type {
  SearchProvider,
  TranscriptProvider,
  VideoClipProvider,
} from "@/lib/providers/types";
import type { ApiBudget } from "@/lib/guards/budgets";

export function createTranscriptProvider(
  id = process.env.TRANSCRIPT_PROVIDER || "youtube-unofficial",
): TranscriptProvider {
  switch (id) {
    case "filmot":
      return new FilmotCaptionProvider();
    case "youtube-unofficial":
    default:
      return new YoutubeUnofficialTranscriptProvider();
  }
}

export function createSearchProvider(
  id = "youtube-data-api",
): SearchProvider {
  switch (id) {
    case "filmot-search":
      return new FilmotSearchProvider();
    case "youtube-data-api":
    default:
      return new YoutubeDataApiSearchProvider();
  }
}

/** Ordered clip providers for the Phase 1 loop (YouTube only). */
export function createClipProviders(budget: ApiBudget): VideoClipProvider[] {
  const youtube = new YoutubeCompositeClipProvider(
    createSearchProvider("youtube-data-api"),
    createTranscriptProvider(),
    budget,
  );
  // Filmot kept in registry for future enablement; returns [] for now.
  const filmot = new FilmotClipProvider();
  return [youtube, filmot];
}
