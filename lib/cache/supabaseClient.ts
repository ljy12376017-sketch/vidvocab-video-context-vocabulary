import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "@/lib/env";

let cached: SupabaseClient | null = null;

/** Anon key only — never service_role. */
export function getSupabase(): SupabaseClient | null {
  const cfg = getSupabasePublicConfig();
  if (!cfg) return null;
  if (!cached) {
    cached = createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}
