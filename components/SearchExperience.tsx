"use client";

import { useEffect, useMemo, useState } from "react";
import { WordSearchBar } from "@/components/WordSearchBar";
import { WordDefinitionCard } from "@/components/WordDefinitionCard";
import { ClipPlayerCard } from "@/components/ClipPlayerCard";
import { FallbackStoryCard } from "@/components/FallbackStoryCard";
import type { ClipsResponse, DefineResponse } from "@/lib/types";

const FUNNY_LOADING = [
  "正在翻字幕找线索……",
  "把单词塞进真实对话里……",
  "问问 DeepSeek 这词啥意思……",
  "YouTube 里捞语境片段中……",
  "路过几个没字幕的视频，继续找……",
];

const DEMO_KEY = "vidvocab_demo_wordbook";

export function SearchExperience({
  missingPlaceholders,
}: {
  missingPlaceholders: string[];
}) {
  const [defining, setDefining] = useState(false);
  const [clipping, setClipping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [defineResult, setDefineResult] = useState<DefineResponse | null>(null);
  const [clipsResult, setClipsResult] = useState<ClipsResponse | null>(null);
  const [tick, setTick] = useState(0);
  const [savedWords, setSavedWords] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DEMO_KEY);
      if (raw) setSavedWords(JSON.parse(raw) as string[]);
    } catch {
      // ignore
    }
  }, []);

  const loadingLine = useMemo(() => {
    if (!defining && !clipping) return null;
    return FUNNY_LOADING[tick % FUNNY_LOADING.length];
  }, [defining, clipping, tick]);

  function saveDemoWord(word: string) {
    setSavedWords((prev) => {
      const next = prev.includes(word) ? prev : [...prev, word];
      localStorage.setItem(DEMO_KEY, JSON.stringify(next));
      return next;
    });
  }

  async function handleSearch(word: string) {
    setError(null);
    setDefineResult(null);
    setClipsResult(null);
    setDefining(true);
    setTick((t) => t + 1);

    const pulse = window.setInterval(() => setTick((t) => t + 1), 1800);

    try {
      const defineRes = await fetch("/api/define", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word }),
      });
      const defineJson = await defineRes.json();
      if (!defineRes.ok) {
        throw new Error(
          defineJson.error ||
            (defineJson.placeholders
              ? `请先配置密钥：${defineJson.placeholders.join(", ")}`
              : "释义失败"),
        );
      }

      const definition = defineJson as DefineResponse;
      setDefineResult(definition);
      setDefining(false);
      setClipping(true);

      const clipsRes = await fetch("/api/clips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          definition: definition.definition,
          bypassCache: false,
        }),
      });
      const clipsJson = await clipsRes.json();
      if (!clipsRes.ok) {
        throw new Error(
          clipsJson.error ||
            (clipsJson.placeholders
              ? `请先配置密钥：${clipsJson.placeholders.join(", ")}`
              : "片段检索失败"),
        );
      }
      setClipsResult(clipsJson as ClipsResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "出了点小状况");
    } finally {
      window.clearInterval(pulse);
      setDefining(false);
      setClipping(false);
    }
  }

  const currentWord = defineResult?.definition.word;
  const saved = currentWord ? savedWords.includes(currentWord) : false;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-16 pt-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#ff6b4a] text-lg font-black text-white shadow-[0_8px_20px_rgba(255,107,74,0.35)]">
            V
          </div>
          <div>
            <p className="text-lg font-black tracking-tight text-[#1f2a2e]">
              VidVocab
            </p>
            <p className="text-xs text-[#1f2a2e]/50">视频语境背单词</p>
          </div>
        </div>
        <nav className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-white/70 px-3 py-1.5 font-semibold text-[#0f7a72] ring-1 ring-[#2ec4b6]/25">
            今日心情：跟影视学单词
          </span>
          <span className="rounded-full bg-white/50 px-3 py-1.5 text-[#1f2a2e]/55">
            本地演示本 {savedWords.length} 词
          </span>
        </nav>
      </header>

      <section className="rounded-[32px] bg-gradient-to-br from-white/90 via-[#fff8f1]/90 to-[#e8fffb]/70 p-6 shadow-[0_16px_50px_rgba(255,107,74,0.1)] ring-1 ring-white/60 sm:p-10">
        <p className="mb-3 inline-flex rounded-full bg-[#2ec4b6] px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
          看语境，不死背
        </p>
        <h1 className="max-w-2xl text-4xl font-black leading-tight text-[#1f2a2e] sm:text-5xl">
          把单词从字幕里
          <span className="text-[#ff6b4a]">揪出来</span>
        </h1>
        <p className="mt-3 max-w-xl text-base text-[#1f2a2e]/65 sm:text-lg">
          轻松、有点搞笑——用真实影视片段记住用法，而不是严肃教培那一套。
        </p>
        <div className="mt-8">
          <WordSearchBar onSearch={handleSearch} loading={defining || clipping} />
        </div>
      </section>

      {missingPlaceholders.length > 0 && (
        <div className="rounded-3xl border-2 border-[#ff6b4a] bg-[#fff3e8] p-5">
          <p className="mb-2 font-bold text-[#b5442a]">还差密钥才能真正开搜</p>
          <ul className="space-y-1 font-mono text-sm text-[#1f2a2e]">
            {missingPlaceholders.map((p) => (
              <li key={p} className="rounded-lg bg-white/70 px-3 py-1">
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      {loadingLine && (
        <p className="animate-pulse text-center text-lg font-semibold text-[#2ec4b6]">
          {loadingLine}
        </p>
      )}

      {error && (
        <div className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-red-700">
          {error}
        </div>
      )}

      {defineResult && (
        <WordDefinitionCard
          definition={defineResult.definition}
          fromCache={defineResult.fromCache}
          notice={defineResult.notice}
          saved={saved}
          onSaveDemo={() => saveDemoWord(defineResult.definition.word)}
        />
      )}

      {clipsResult?.notices?.map((n) => (
        <p
          key={n}
          className="rounded-2xl bg-[#e8fffb] px-4 py-3 text-sm font-medium text-[#0f7a72]"
        >
          {n}
        </p>
      ))}

      {clipping && !clipsResult && (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-72 animate-pulse rounded-[24px] bg-white/60"
            />
          ))}
        </div>
      )}

      {clipsResult && clipsResult.clips.length > 0 && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-2xl font-black text-[#1f2a2e]">视频语境</h2>
            <p className="text-sm text-[#1f2a2e]/45">
              {clipsResult.matchMode === "exact" && "精确匹配片段"}
              {clipsResult.matchMode === "synonym" && "近义词语境片段"}
              {clipsResult.fromCache ? " · 来自缓存" : ""}
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {clipsResult.clips.map((clip) => (
              <ClipPlayerCard
                key={clip.id}
                clip={clip}
                matchMode={clipsResult.matchMode}
              />
            ))}
          </div>
        </section>
      )}

      {clipsResult?.fallbackStory && (
        <FallbackStoryCard story={clipsResult.fallbackStory} />
      )}

      {!defineResult && !error && !defining && (
        <div className="rounded-[28px] border border-dashed border-[#1f2a2e]/15 bg-white/50 p-8 text-center text-[#1f2a2e]/55">
          点上面的示例词，或搜{" "}
          <strong className="text-[#ff6b4a]">serendipity</strong> 开始
        </div>
      )}
    </div>
  );
}
