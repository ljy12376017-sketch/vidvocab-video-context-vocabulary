import { YoutubeDataApiSearchProvider } from "@/lib/providers/search/youtubeDataApiSearch";
import { FilmotSearchProvider } from "@/lib/providers/search/filmotSearch";
import { YoutubeUnofficialTranscriptProvider } from "@/lib/providers/transcript/youtubeUnofficialTranscript";
import { YoutubeTranscriptAiProvider } from "@/lib/providers/transcript/youtubeTranscriptAi";
import { ChainedTranscriptProvider } from "@/lib/providers/transcript/chainedTranscript";
import { FilmotCaptionProvider } from "@/lib/providers/transcript/filmotCaption";
import { YoutubeCompositeClipProvider } from "@/lib/providers/clip/youtubeComposite";
import { FilmotClipProvider } from "@/lib/providers/clip/filmotClip";
import type {
  SearchProvider,
  TranscriptProvider,
  VideoClipProvider,
} from "@/lib/providers/types";
import type { ApiBudget } from "@/lib/guards/budgets";

/**
 * Default: youtube-transcript.ai (Vercel-friendly) → youtube-unofficial fallback.
 * Override with TRANSCRIPT_PROVIDER=youtube-transcript-ai | youtube-unofficial | filmot | chain
 */
export function createTranscriptProvider(
  id = process.env.TRANSCRIPT_PROVIDER || "chain",
): TranscriptProvider {
  switch (id) {
    case "filmot":
      return new FilmotCaptionProvider();
    case "youtube-transcript-ai":
      return new YoutubeTranscriptAiProvider();
    case "youtube-unofficial":
      return new YoutubeUnofficialTranscriptProvider();
    case "chain":
    default:
      return new ChainedTranscriptProvider(
        new YoutubeTranscriptAiProvider(),
        new YoutubeUnofficialTranscriptProvider(),
      );
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
