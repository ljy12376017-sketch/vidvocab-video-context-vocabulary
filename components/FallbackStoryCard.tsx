import type { FallbackStory } from "@/lib/types";

export function FallbackStoryCard({ story }: { story: FallbackStory }) {
  return (
    <section className="rounded-[28px] border-2 border-dashed border-[#ff6b4a]/55 bg-gradient-to-br from-[#fff3e8] to-[#ffe8d6] p-6 sm:p-8">
      <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#b5442a]">
        <span className="h-2 w-2 rounded-full bg-[#ff6b4a]" />
        AI 情境示例 · 非真实视频
      </div>
      <h3 className="mb-3 text-2xl font-black text-[#1f2a2e] sm:text-3xl">
        {story.titleZh}
      </h3>
      <p className="whitespace-pre-wrap text-base leading-8 text-[#1f2a2e]/85">
        {story.bodyZh}
      </p>
      <p className="mt-5 text-xs text-[#b5442a]/80">
        暂时没有可播放的真实片段时，用这段虚构小故事帮你记住用法。
      </p>
    </section>
  );
}
