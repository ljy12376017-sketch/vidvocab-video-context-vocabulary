import { locateClipsInTranscript } from "@/lib/providers/clipBuilder";
import {
  filterEmbeddable,
} from "@/lib/providers/search/youtubeDataApiSearch";
import type {
  RawClipCandidate,
  SearchProvider,
  TranscriptProvider,
  VideoClipProvider,
} from "@/lib/providers/types";
import type { ApiBudget } from "@/lib/guards/budgets";
import type {
  CandidateDiag,
  PipelineDiagnostics,
  PipelineErrorCode,
} from "@/lib/diagnostics/types";
import { classifyYoutubeError, logSafe } from "@/lib/diagnostics/safeLog";
import {
  ensureYoutubeNetwork,
  getActiveProxyHost,
} from "@/lib/http/ensureProxy";

export class YoutubeCompositeClipProvider implements VideoClipProvider {
  readonly id = "youtube-composite";

  readonly diagnostics: PipelineDiagnostics = {
    networkMode: "none",
    proxyHost: null,
    searchCalls: 0,
    candidatesTried: 0,
    transcriptsOk: 0,
    matchedClips: 0,
    primaryFailureCode: "OK",
    candidates: [],
    progressNotices: [],
  };

  constructor(
    private readonly searchProvider: SearchProvider,
    private readonly transcriptProvider: TranscriptProvider,
    private readonly budget: ApiBudget,
  ) {}

  async searchClips(query: string, limit: number): Promise<RawClipCandidate[]> {
    const net = await ensureYoutubeNetwork();
    this.diagnostics.networkMode = net.mode;
    this.diagnostics.proxyHost = getActiveProxyHost();

    if (net.mode === "none") {
      this.diagnostics.primaryFailureCode = "YOUTUBE_NETWORK_TIMEOUT";
      this.pushNotice(
        "暂时连不上 YouTube。请开启本地代理，或在环境变量设置 YOUTUBE_HTTPS_PROXY 后重启。",
      );
      return [];
    }

    if (!this.budget.canSearch()) return [];
    this.budget.useSearch();
    this.diagnostics.searchCalls += 1;

    const candidatesNeeded = Math.min(15, Math.max(limit * 3, 10));
    let videos;
    try {
      videos = await this.searchProvider.search(query, candidatesNeeded);
    } catch (e) {
      const code =
        ((e as { code?: string }).code as PipelineErrorCode) ||
        classifyYoutubeError(e).code;
      this.diagnostics.primaryFailureCode = code as PipelineErrorCode;
      this.pushNotice(classifyYoutubeError(e).userMessage);
      logSafe("error", "youtube-composite", code, {});
      return [];
    }

    if (videos.length === 0) {
      this.diagnostics.primaryFailureCode = "YOUTUBE_SEARCH_EMPTY";
      this.pushNotice("没有搜到相关候选视频，稍后会尝试近义词或情境示例。");
      return [];
    }

    const embeddable = await filterEmbeddable(videos.map((v) => v.videoId));
    const clips: RawClipCandidate[] = [];

    for (const video of videos) {
      if (clips.length >= limit) break;
      if (!this.budget.canTranscript()) break;

      this.diagnostics.candidatesTried += 1;

      if (!embeddable.has(video.videoId)) {
        this.recordCandidate(video.videoId, video.title, "embed_forbidden", "EMBED_FORBIDDEN");
        this.pushNotice(
          "有个候选视频禁止嵌入播放，正在尝试其他视频…",
        );
        continue;
      }

      try {
        this.budget.useTranscript();
        const cues = await this.transcriptProvider.fetchTranscript(
          video.videoId,
          ["en"],
        );
        this.diagnostics.transcriptsOk += 1;

        const found = locateClipsInTranscript({
          videoId: video.videoId,
          title: video.title,
          sourceUrl: video.sourceUrl,
          source: "youtube",
          query,
          cues,
          maxPerVideo: 2,
        });

        if (found.length === 0) {
          this.recordCandidate(
            video.videoId,
            video.title,
            "no_word_match",
            "NO_WORD_MATCH_IN_CAPTIONS",
          );
          this.pushNotice(
            "已找到候选视频且有字幕，但未精确命中目标词，正在尝试其他视频…",
          );
          continue;
        }

        this.recordCandidate(video.videoId, video.title, "matched", "OK");
        clips.push(...found);
      } catch (e) {
        const classified = classifyYoutubeError(e);
        const code =
          ((e as { code?: string }).code as PipelineErrorCode) ||
          (classified.code as PipelineErrorCode);
        const status =
          code === "TRANSCRIPT_DISABLED"
            ? "transcript_disabled"
            : "no_transcript";
        this.recordCandidate(video.videoId, video.title, status, code);
        this.pushNotice(classified.userMessage);
      }
    }

    this.diagnostics.matchedClips = clips.length;
    if (clips.length === 0 && this.diagnostics.primaryFailureCode === "OK") {
      this.diagnostics.primaryFailureCode = "ALL_CANDIDATES_FAILED";
    }

    logSafe("info", "youtube-composite", "ROUND_DONE", {
      queryLen: query.length,
      tried: this.diagnostics.candidatesTried,
      matched: clips.length,
      primary: this.diagnostics.primaryFailureCode,
    });

    return clips.slice(0, limit);
  }

  getDiagnostics() {
    return this.diagnostics;
  }

  private recordCandidate(
    videoId: string,
    title: string,
    status: CandidateDiag["status"],
    code: PipelineErrorCode,
  ) {
    this.diagnostics.candidates.push({
      videoId,
      title: title.slice(0, 80),
      status,
      code,
    });
    if (
      this.diagnostics.primaryFailureCode === "OK" &&
      code !== "OK"
    ) {
      this.diagnostics.primaryFailureCode = code;
    }
  }

  private pushNotice(msg: string) {
    if (!this.diagnostics.progressNotices.includes(msg)) {
      this.diagnostics.progressNotices.push(msg);
    }
  }
}
