import { BUDGETS } from "@/lib/guards/budgets";
import type { RawClipCandidate, TranscriptCue } from "@/lib/providers/types";

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\s'-]/gu, " ").replace(/\s+/g, " ").trim();
}

function wordBoundaryMatch(haystack: string, needle: string): boolean {
  const h = normalize(haystack);
  const n = normalize(needle);
  if (!n) return false;
  if (n.includes(" ")) return h.includes(n);
  const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\s)${escaped}(?:$|\\s|[.,!?;:'"])`, "i").test(h);
}

/** Expand a hit cue into a 10–25s window (±3s tolerance via BUDGETS). */
export function buildClipWindow(
  cues: TranscriptCue[],
  hitIndex: number,
): { startSec: number; endSec: number } | null {
  const hit = cues[hitIndex];
  if (!hit) return null;

  const ideal = BUDGETS.idealClipSec;
  let start = hit.startSec;
  let end = hit.startSec + Math.max(hit.durationSec, 2);

  let i = hitIndex - 1;
  let j = hitIndex + 1;
  while (end - start < ideal && (i >= 0 || j < cues.length)) {
    const need = ideal - (end - start);
    if (i >= 0 && j < cues.length) {
      const leftGain = start - cues[i].startSec;
      const rightGain =
        cues[j].startSec + cues[j].durationSec - end;
      if (leftGain <= rightGain) {
        start = cues[i].startSec;
        i -= 1;
      } else {
        end = cues[j].startSec + cues[j].durationSec;
        j += 1;
      }
    } else if (i >= 0) {
      start = cues[i].startSec;
      i -= 1;
    } else if (j < cues.length) {
      end = cues[j].startSec + cues[j].durationSec;
      j += 1;
    }
    if (need <= 0) break;
  }

  if (end - start < BUDGETS.minClipSec) {
    end = start + BUDGETS.minClipSec;
  }
  if (end - start > BUDGETS.maxClipSec) {
    const mid = (start + end) / 2;
    start = mid - BUDGETS.idealClipSec / 2;
    end = mid + BUDGETS.idealClipSec / 2;
  }

  start = Math.max(0, Math.floor(start));
  end = Math.ceil(end);
  const duration = end - start;
  if (duration < BUDGETS.minClipSec || duration > BUDGETS.maxClipSec) {
    return null;
  }
  return { startSec: start, endSec: end };
}

export function locateClipsInTranscript(opts: {
  videoId: string;
  title: string;
  sourceUrl: string;
  source: RawClipCandidate["source"];
  query: string;
  cues: TranscriptCue[];
  maxPerVideo?: number;
}): RawClipCandidate[] {
  const { query, cues, maxPerVideo = 2 } = opts;
  const out: RawClipCandidate[] = [];

  for (let i = 0; i < cues.length && out.length < maxPerVideo; i++) {
    if (!wordBoundaryMatch(cues[i].text, query)) continue;
    const window = buildClipWindow(cues, i);
    if (!window) continue;

    const overlaps = out.some(
      (c) =>
        Math.abs(c.startSec - window.startSec) < 8 ||
        (window.startSec < c.endSec && window.endSec > c.startSec),
    );
    if (overlaps) continue;

    out.push({
      videoId: opts.videoId,
      title: opts.title,
      sourceUrl: opts.sourceUrl,
      source: opts.source,
      startSec: window.startSec,
      endSec: window.endSec,
      matchedText: cues[i].text.trim(),
      matchedQuery: query,
    });
  }

  return out;
}
