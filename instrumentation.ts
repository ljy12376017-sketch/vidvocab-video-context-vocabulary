export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureYoutubeNetwork } = await import("@/lib/http/ensureProxy");
    await ensureYoutubeNetwork();
  }
}
