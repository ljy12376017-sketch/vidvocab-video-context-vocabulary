import type { MatchMode, VideoClip } from "@/lib/types";

function matchBadge(clip: VideoClip, matchMode: MatchMode) {
  if (clip.isSynonymMatch || matchMode === "synonym") {
    return {
      label: "近义词语境",
      className: "bg-[#fff3e8] text-[#b5442a]",
    };
  }
  return {
    label: "精确匹配",
    className: "bg-[#e8fffb] text-[#0f7a72]",
  };
}

export function ClipPlayerCard({
  clip,
  matchMode,
}: {
  clip: VideoClip;
  matchMode: MatchMode;
}) {
  const badge = matchBadge(clip, matchMode);

  return (
    <article className="overflow-hidden rounded-[24px] border border-[#1f2a2e]/8 bg-white shadow-[0_10px_32px_rgba(31,42,46,0.08)]">
      <div className="aspect-video bg-[#1f2a2e]">
        <iframe
          title={clip.title}
          src={clip.embedUrl}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      <div className="space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${badge.className}`}
          >
            {badge.label}
          </span>
          <span className="rounded-full bg-[#1f2a2e]/8 px-2.5 py-0.5 text-xs font-bold text-[#1f2a2e]">
            {clip.durationSec}s
          </span>
          {clip.isSynonymMatch && (
            <span className="text-xs text-[#1f2a2e]/45">
              命中词 · {clip.matchedQuery}
            </span>
          )}
        </div>
        <h3 className="line-clamp-2 text-base font-bold text-[#1f2a2e]">
          {clip.title}
        </h3>
        <p className="text-sm leading-relaxed text-[#1f2a2e]/80">
          {clip.summaryZh}
        </p>
        <p className="text-sm leading-relaxed text-[#0f7a72]">{clip.contextZh}</p>
        <p className="rounded-xl bg-[#f4f7f6] px-3 py-2 text-xs leading-relaxed text-[#1f2a2e]/55">
          台词：{clip.matchedText}
        </p>
        <a
          href={clip.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex text-sm font-bold text-[#ff6b4a] underline-offset-2 hover:underline"
        >
          打开原视频 →
        </a>
      </div>
    </article>
  );
}
