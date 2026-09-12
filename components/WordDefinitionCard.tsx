import type { WordDefinition } from "@/lib/types";

export function WordDefinitionCard({
  definition,
  fromCache,
  notice,
  onSaveDemo,
  saved,
}: {
  definition: WordDefinition;
  fromCache?: boolean;
  notice?: string;
  onSaveDemo?: () => void;
  saved?: boolean;
}) {
  return (
    <section className="rounded-[28px] border border-[#1f2a2e]/8 bg-white/95 p-6 shadow-[0_12px_40px_rgba(31,42,46,0.08)] sm:p-8">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-[#2ec4b6]">
            单词现场
          </p>
          <h2 className="text-4xl font-black tracking-tight text-[#1f2a2e] sm:text-5xl">
            {definition.word}
          </h2>
          <p className="mt-2 text-sm text-[#1f2a2e]/55">
            语言标识 · {definition.language.toUpperCase()}
            {definition.englishEquivalent
              ? ` · 英文对应 ${definition.englishEquivalent}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {definition.partOfSpeech.map((p) => (
            <span
              key={p}
              className="rounded-full bg-[#fff3e8] px-3 py-1 text-sm font-bold text-[#ff6b4a]"
            >
              {p}
            </span>
          ))}
          {fromCache && (
            <span className="rounded-full bg-[#e8fffb] px-3 py-1 text-sm font-bold text-[#0f7a72]">
              缓存
            </span>
          )}
        </div>
      </div>

      <ul className="mb-5 space-y-2 text-lg leading-relaxed text-[#1f2a2e]">
        {definition.meaningsZh.map((m) => (
          <li key={m} className="flex gap-2">
            <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#ff6b4a]" />
            <span>{m}</span>
          </li>
        ))}
      </ul>

      {notice && (
        <p className="mb-5 rounded-2xl bg-[#fff3e8] px-4 py-3 text-sm text-[#b5442a]">
          {notice}
        </p>
      )}

      {definition.examples.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-[#1f2a2e]/45">
            例句
          </h3>
          {definition.examples.map((ex) => (
            <blockquote
              key={ex.sentence}
              className="rounded-2xl bg-[#fffaf5] px-4 py-3 ring-1 ring-[#ff6b4a]/10"
            >
              <p className="font-semibold text-[#1f2a2e]">{ex.sentence}</p>
              <p className="mt-1 text-sm text-[#1f2a2e]/55">{ex.translationZh}</p>
            </blockquote>
          ))}
        </div>
      )}

      {onSaveDemo && (
        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-[#1f2a2e]/8 pt-5">
          <button
            type="button"
            onClick={onSaveDemo}
            className="rounded-full bg-[#2ec4b6] px-4 py-2 text-sm font-bold text-white transition hover:brightness-105"
          >
            {saved ? "已加入本地演示单词本" : "加入单词本（本地演示）"}
          </button>
          <p className="text-xs text-[#1f2a2e]/45">
            Phase 1 演示：仅保存在本机浏览器，跨设备同步将在后续版本上线
          </p>
        </div>
      )}
    </section>
  );
}
