import { getSupabase } from "@/lib/cache/supabaseClient";
import { BUDGETS } from "@/lib/guards/budgets";
import type {
  FallbackStory,
  MatchMode,
  VideoClip,
  WordDefinition,
} from "@/lib/types";

function normalizeWord(word: string): string {
  return word.trim().toLowerCase();
}

export async function readWordCache(word: string, langHint = "auto") {
  const sb = getSupabase();
  if (!sb) return null;

  const { data, error } = await sb
    .from("word_query_cache")
    .select("*")
    .eq("word_normalized", normalizeWord(word))
    .eq("lang_hint", langHint)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) {
    console.warn("[cache] read failed", error.message);
    return null;
  }
  return data;
}

export async function writeWordCache(input: {
  word: string;
  langHint?: string;
  definition: WordDefinition;
  clips?: VideoClip[] | null;
  fallbackStory?: FallbackStory | null;
  matchMode: MatchMode;
}) {
  const sb = getSupabase();
  if (!sb) return { ok: false as const, reason: "supabase_not_configured" };

  const now = new Date();
  const expires = new Date(
    now.getTime() + BUDGETS.cacheTtlDays * 24 * 60 * 60 * 1000,
  );

  const row = {
    word_normalized: normalizeWord(input.word),
    lang_hint: input.langHint || "auto",
    definition_json: input.definition,
    clips_json: input.clips ?? null,
    fallback_story: input.fallbackStory ?? null,
    match_mode: input.matchMode,
    created_at: now.toISOString(),
    expires_at: expires.toISOString(),
  };

  const { error } = await sb.from("word_query_cache").upsert(row, {
    onConflict: "word_normalized,lang_hint",
  });

  if (error) {
    console.warn("[cache] write failed", error.message);
    return { ok: false as const, reason: error.message };
  }
  return { ok: true as const };
}
