"use client";

import { FormEvent, useState } from "react";

const EXAMPLES = ["serendipity", "book", "procrastinate", "ephemeral", "bookaholic"];

export function WordSearchBar({
  onSearch,
  loading,
}: {
  onSearch: (word: string) => void;
  loading: boolean;
}) {
  const [value, setValue] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const word = value.trim();
    if (!word || loading) return;
    onSearch(word);
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit}
        className="flex w-full flex-col gap-3 sm:flex-row"
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="输入任意语言的单词，比如 serendipity / 美味しい"
          className="min-h-16 flex-1 rounded-2xl border-2 border-[#1f2a2e]/15 bg-white px-6 text-xl text-[#1f2a2e] shadow-[0_8px_30px_rgba(255,107,74,0.12)] outline-none transition placeholder:text-[#1f2a2e]/35 focus:border-[#ff6b4a] focus:shadow-[0_8px_30px_rgba(255,107,74,0.25)]"
          disabled={loading}
          maxLength={80}
        />
        <button
          type="submit"
          disabled={loading || !value.trim()}
          className="min-h-16 rounded-2xl bg-[#ff6b4a] px-10 text-xl font-bold text-white shadow-[0_8px_24px_rgba(255,107,74,0.35)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "翻找中…" : "开找！"}
        </button>
      </form>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-[#1f2a2e]/50">试试：</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            disabled={loading}
            onClick={() => {
              setValue(ex);
              onSearch(ex);
            }}
            className="rounded-full bg-white/80 px-3 py-1 text-sm font-semibold text-[#0f7a72] ring-1 ring-[#2ec4b6]/30 transition hover:bg-[#e8fffb]"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
