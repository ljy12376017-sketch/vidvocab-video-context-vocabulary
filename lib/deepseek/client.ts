import OpenAI from "openai";
import { requireDeepseekKey } from "@/lib/env";

let client: OpenAI | null = null;

export function getDeepseekClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: requireDeepseekKey(),
      baseURL: "https://api.deepseek.com",
    });
  }
  return client;
}

export async function chatJson<T>(
  system: string,
  user: string,
  opts?: { temperature?: number },
): Promise<T> {
  const openai = getDeepseekClient();
  const completion = await openai.chat.completions.create({
    model: "deepseek-chat",
    temperature: opts?.temperature ?? 0.4,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const choices = completion?.choices;
  if (!choices?.length) {
    throw new Error("DeepSeek 返回异常（无 choices），请稍后重试");
  }
  const raw = choices[0]?.message?.content;
  if (!raw) throw new Error("DeepSeek 返回空内容");
  return JSON.parse(raw) as T;
}
