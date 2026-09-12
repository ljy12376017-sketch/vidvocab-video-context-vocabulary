export const BUDGETS = {
  maxDeepseekCallsPerWord: 4,
  maxTranscriptCallsPerWord: 20,
  maxSearchCallsPerWord: 4,
  maxSynonyms: 3,
  targetClips: 5,
  maxClips: 6,
  minClipSec: 7,
  maxClipSec: 28,
  idealClipSec: 18,
  cacheTtlDays: 30,
} as const;

export class ApiBudget {
  deepseekCalls = 0;
  transcriptCalls = 0;
  searchCalls = 0;

  canDeepseek(): boolean {
    return this.deepseekCalls < BUDGETS.maxDeepseekCallsPerWord;
  }

  canTranscript(): boolean {
    return this.transcriptCalls < BUDGETS.maxTranscriptCallsPerWord;
  }

  canSearch(): boolean {
    return this.searchCalls < BUDGETS.maxSearchCallsPerWord;
  }

  useDeepseek(): void {
    if (!this.canDeepseek()) {
      throw new Error("DeepSeek API 调用已达上限，已停止本词的进一步生成。");
    }
    this.deepseekCalls += 1;
  }

  useTranscript(): void {
    if (!this.canTranscript()) {
      throw new Error("字幕拉取次数已达上限。");
    }
    this.transcriptCalls += 1;
  }

  useSearch(): void {
    if (!this.canSearch()) {
      throw new Error("视频搜索次数已达上限。");
    }
    this.searchCalls += 1;
  }

  snapshot() {
    return {
      deepseekCalls: this.deepseekCalls,
      transcriptCalls: this.transcriptCalls,
      searchCalls: this.searchCalls,
    };
  }
}
