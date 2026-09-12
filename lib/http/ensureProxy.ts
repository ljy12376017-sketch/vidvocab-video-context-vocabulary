import { ProxyAgent, fetch as undiciFetch } from "undici";
import { logSafe } from "@/lib/diagnostics/safeLog";

export type ProxyMode = "env" | "auto" | "direct" | "none";

let ready: Promise<{ mode: ProxyMode; proxyUrl: string | null }> | null = null;
let activeProxy: string | null = null;
let proxyAgent: ProxyAgent | null = null;

const AUTO_CANDIDATES = [
  "http://127.0.0.1:7897",
  "http://127.0.0.1:7890",
  "http://127.0.0.1:1087",
  "http://127.0.0.1:6152",
  "http://127.0.0.1:7891",
];

function configuredProxy(): string | null {
  const raw =
    process.env.YOUTUBE_HTTPS_PROXY ||
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    "";
  const v = raw.trim();
  if (!v || v.startsWith("your_")) return null;
  return v;
}

async function probeDirect(): Promise<boolean> {
  try {
    const res = await undiciFetch("https://www.googleapis.com/generate_204", {
      signal: AbortSignal.timeout(4000),
    });
    return res.status === 204 || res.ok;
  } catch {
    return false;
  }
}

async function probeProxy(proxyUrl: string): Promise<boolean> {
  try {
    const agent = new ProxyAgent(proxyUrl);
    const res = await undiciFetch("https://www.googleapis.com/generate_204", {
      dispatcher: agent,
      signal: AbortSignal.timeout(4000),
    });
    return res.status === 204 || res.ok;
  } catch {
    return false;
  }
}

/**
 * Idempotent YouTube/Google network setup.
 * IMPORTANT: never setGlobalDispatcher — DeepSeek/Supabase must stay direct.
 */
export function ensureYoutubeNetwork(): Promise<{
  mode: ProxyMode;
  proxyUrl: string | null;
}> {
  if (!ready) {
    ready = (async () => {
      const fromEnv = configuredProxy();
      if (fromEnv) {
        activeProxy = fromEnv;
        proxyAgent = new ProxyAgent(fromEnv);
        logSafe("info", "net", "using_configured_proxy", {
          host: safeProxyHost(fromEnv),
        });
        return { mode: "env" as const, proxyUrl: fromEnv };
      }

      if (await probeDirect()) {
        activeProxy = null;
        proxyAgent = null;
        logSafe("info", "net", "direct_googleapis_ok", {});
        return { mode: "direct" as const, proxyUrl: null };
      }

      for (const candidate of AUTO_CANDIDATES) {
        if (await probeProxy(candidate)) {
          activeProxy = candidate;
          proxyAgent = new ProxyAgent(candidate);
          logSafe("info", "net", "auto_proxy_ok", {
            host: safeProxyHost(candidate),
          });
          return { mode: "auto" as const, proxyUrl: candidate };
        }
      }

      logSafe("error", "net", "googleapis_unreachable", {
        hint: "direct_and_common_local_proxies_failed",
      });
      return { mode: "none" as const, proxyUrl: null };
    })();
  }
  return ready;
}

export function getActiveProxyHost(): string | null {
  return activeProxy ? safeProxyHost(activeProxy) : null;
}

function safeProxyHost(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}:${u.port || ""}`;
  } catch {
    return "invalid_proxy_url";
  }
}

/** Fetch ONLY for YouTube / Google APIs — optional local proxy, never global. */
export async function youtubeFetch(
  input: string | URL,
  init?: RequestInit,
): Promise<Response> {
  await ensureYoutubeNetwork();
  const url = typeof input === "string" ? input : input.toString();

  if (proxyAgent) {
    const res = await undiciFetch(url, {
      method: init?.method,
      headers: init?.headers as Record<string, string> | undefined,
      body: init?.body as string | undefined,
      signal: init?.signal as AbortSignal | undefined,
      dispatcher: proxyAgent,
    });
    return res as unknown as Response;
  }

  const res = await undiciFetch(url, {
    method: init?.method,
    headers: init?.headers as Record<string, string> | undefined,
    body: init?.body as string | undefined,
    signal: init?.signal as AbortSignal | undefined,
  });
  return res as unknown as Response;
}
