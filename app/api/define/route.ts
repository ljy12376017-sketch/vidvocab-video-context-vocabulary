import { NextResponse } from "next/server";
import { defineWord } from "@/lib/deepseek/defineWord";
import { missingSecrets } from "@/lib/env";
import { ApiBudget } from "@/lib/guards/budgets";
import { clientIp, rateLimit } from "@/lib/guards/rateLimit";
import { readWordCache, writeWordCache } from "@/lib/cache/wordCache";
import type { DefineResponse } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const ip = clientIp(req);
  const limited = rateLimit(`define:${ip}`, 20, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: `请求太频繁，请 ${limited.retryAfterSec}s 后再试` },
      { status: 429 },
    );
  }

  const missing = missingSecrets().filter((s) => s.startsWith("DEEPSEEK"));
  if (missing.length) {
    return NextResponse.json(
      {
        error: "DeepSeek 密钥未配置",
        placeholders: missing,
        hint: "请编辑 .env.local，把 your_deepseek_api_key 换成真实密钥后重启 npm run dev",
      },
      { status: 503 },
    );
  }

  let body: { word?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }

  const word = body.word?.trim();
  if (!word || word.length > 80) {
    return NextResponse.json({ error: "请输入有效单词（≤80 字符）" }, { status: 400 });
  }

  try {
    const cached = await readWordCache(word);
    if (cached?.definition_json) {
      const payload: DefineResponse = {
        definition: cached.definition_json,
        fromCache: true,
        notice: cached.definition_json.usedEnglishForSearch
          ? `片段将基于英文对应词「${cached.definition_json.searchTerm}」检索`
          : undefined,
      };
      return NextResponse.json(payload);
    }
  } catch (cacheErr) {
    console.warn(
      "[api/define] cache skipped",
      cacheErr instanceof Error ? cacheErr.message.slice(0, 80) : "cache_error",
    );
  }

  try {
    const budget = new ApiBudget();
    const definition = await defineWord(word, budget);

    try {
      await writeWordCache({
        word,
        definition,
        matchMode: "exact",
        clips: null,
        fallbackStory: null,
      });
    } catch {
      // cache is optional
    }

    const payload: DefineResponse = {
      definition,
      fromCache: false,
      notice: definition.usedEnglishForSearch
        ? `片段将基于英文对应词「${definition.searchTerm}」检索`
        : undefined,
    };
    return NextResponse.json(payload);
  } catch (e) {
    console.error("[api/define]", e instanceof Error ? e.message : "define_failed");
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "释义生成失败",
        code: "DEFINE_FAILED",
      },
      { status: 500 },
    );
  }
}
