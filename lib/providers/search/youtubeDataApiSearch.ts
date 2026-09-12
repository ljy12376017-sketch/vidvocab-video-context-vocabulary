import { requireYoutubeKey } from "@/lib/env";
import { youtubeFetch } from "@/lib/http/ensureProxy";
import { classifyYoutubeError, logSafe } from "@/lib/diagnostics/safeLog";
import type { SearchProvider, SearchVideoHit } from "@/lib/providers/types";

export class YoutubeDataApiSearchProvider implements SearchProvider {
  readonly id = "youtube-data-api";

  async search(query: string, limit: number): Promise<SearchVideoHit[]> {
    const key = requireYoutubeKey();
    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("type", "video");
    url.searchParams.set("videoEmbeddable", "true");
    url.searchParams.set("maxResults", String(Math.min(Math.max(limit, 1), 15)));
    url.searchParams.set("q", `"${query}"`);
    url.searchParams.set("relevanceLanguage", "en");
    url.searchParams.set("safeSearch", "moderate");
    url.searchParams.set("key", key);

    let res: Response;
    try {
      res = await youtubeFetch(url.toString(), {
        signal: AbortSignal.timeout(20000),
      });
    } catch (e) {
      const classified = classifyYoutubeError(e);
      logSafe("error", "youtube-search", classified.code, {
        queryLen: query.length,
      });
      const err = new Error(classified.userMessage) as Error & {
        code?: string;
      };
      err.code = classified.code;
      throw err;
    }

    if (!res.ok) {
      const body = await res.text();
      const lower = body.toLowerCase();
      let code = "YOUTUBE_SEARCH_FAILED";
      if (lower.includes("quota")) code = "YOUTUBE_QUOTA_EXCEEDED";
      if (lower.includes("keyinvalid") || lower.includes("api key not valid")) {
        code = "YOUTUBE_KEY_INVALID";
      }
      logSafe("error", "youtube-search", code, {
        status: res.status,
        bodySnippet: body.slice(0, 160).replace(/key=[^&\s]+/gi, "key=[REDACTED]"),
      });
      const err = new Error(`YouTube search 失败 (${res.status})`) as Error & {
        code?: string;
      };
      err.code = code;
      throw err;
    }

    const data = (await res.json()) as {
      items?: {
        id?: { videoId?: string };
        snippet?: { title?: string; channelTitle?: string };
      }[];
    };

    const hits: SearchVideoHit[] = [];
    for (const item of data.items || []) {
      const videoId = item.id?.videoId;
      if (!videoId) continue;
      hits.push({
        videoId,
        title: item.snippet?.title || videoId,
        sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
        channelTitle: item.snippet?.channelTitle,
      });
    }

    logSafe("info", "youtube-search", "SEARCH_OK", {
      queryLen: query.length,
      hitCount: hits.length,
    });
    return hits;
  }
}

/** Check embeddable flag via videos.list (never logs key). */
export async function filterEmbeddable(
  videoIds: string[],
): Promise<Set<string>> {
  if (videoIds.length === 0) return new Set();
  const key = requireYoutubeKey();
  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("part", "status");
  url.searchParams.set("id", videoIds.slice(0, 20).join(","));
  url.searchParams.set("key", key);

  try {
    const res = await youtubeFetch(url.toString(), {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return new Set(videoIds);
    const data = (await res.json()) as {
      items?: { id?: string; status?: { embeddable?: boolean } }[];
    };
    const ok = new Set<string>();
    for (const item of data.items || []) {
      if (item.id && item.status?.embeddable !== false) ok.add(item.id);
    }
    return ok;
  } catch (e) {
    logSafe("warn", "youtube-embed", "EMBED_CHECK_FAILED", {
      message: e instanceof Error ? e.message.slice(0, 120) : "unknown",
    });
    return new Set(videoIds);
  }
}
