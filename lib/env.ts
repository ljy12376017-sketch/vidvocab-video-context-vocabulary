function isPlaceholder(value: string | undefined): boolean {
  if (!value || !value.trim()) return true;
  const v = value.trim().toLowerCase();
  return v.startsWith("your_") || v.includes("placeholder");
}

export function getServerEnv() {
  return {
    deepseekApiKey: process.env.DEEPSEEK_API_KEY,
    youtubeApiKey: process.env.YOUTUBE_API_KEY,
    transcriptProvider: process.env.TRANSCRIPT_PROVIDER || "youtube-unofficial",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

export function requireDeepseekKey(): string {
  const key = process.env.DEEPSEEK_API_KEY;
  if (isPlaceholder(key)) {
    throw new Error(
      "DEEPSEEK_API_KEY 仍是占位符 your_deepseek_api_key，请在 .env.local 填入真实密钥后重启 dev server。",
    );
  }
  return key!;
}

export function requireYoutubeKey(): string {
  const key = process.env.YOUTUBE_API_KEY;
  if (isPlaceholder(key)) {
    throw new Error(
      "YOUTUBE_API_KEY 仍是占位符 your_youtube_data_api_key，请在 .env.local 填入真实密钥后重启 dev server。",
    );
  }
  return key!;
}

export function getSupabasePublicConfig():
  | { url: string; anonKey: string }
  | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (isPlaceholder(url) || isPlaceholder(anonKey)) return null;
  return { url: url!, anonKey: anonKey! };
}

export function missingSecrets(): string[] {
  const missing: string[] = [];
  if (isPlaceholder(process.env.DEEPSEEK_API_KEY)) {
    missing.push("DEEPSEEK_API_KEY=your_deepseek_api_key");
  }
  if (isPlaceholder(process.env.YOUTUBE_API_KEY)) {
    missing.push("YOUTUBE_API_KEY=your_youtube_data_api_key");
  }
  if (isPlaceholder(process.env.NEXT_PUBLIC_SUPABASE_URL)) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url");
  }
  if (isPlaceholder(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
    missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key");
  }
  return missing;
}
