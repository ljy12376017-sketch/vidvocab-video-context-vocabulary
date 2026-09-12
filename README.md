# VidVocab · 视频语境背单词

通过真实视频语境学单词的 Web 应用（Next.js + Vercel）。Phase 1 MVP：查词释义 → YouTube 字幕定位片段 → iframe 区间播放。

## 快速开始

```bash
npm install
cp .env.example .env.local   # 若尚无 .env.local
# 编辑 .env.local，把所有 your_* 占位符换成真实密钥
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 需要你手动填的密钥（`.env.local`）

| 变量 | 占位符 | 获取方式 |
|------|--------|----------|
| `DEEPSEEK_API_KEY` | `your_deepseek_api_key` | [DeepSeek 开放平台](https://platform.deepseek.com/) |
| `YOUTUBE_API_KEY` | `your_youtube_data_api_key` | Google Cloud → 启用 YouTube Data API v3 → 创建 API Key |
| `NEXT_PUBLIC_SUPABASE_URL` | `your_supabase_project_url` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `your_supabase_anon_key` | Supabase → Project Settings → API → `anon` `public` key |

**禁止**配置 `service_role`。缓存表使用 anon + RLS。

### Supabase 建表

在 Supabase SQL Editor 执行：

[`supabase/migrations/001_word_cache.sql`](supabase/migrations/001_word_cache.sql)

未配置 Supabase 时应用仍可运行，只是不做 30 天缓存（每次都会打 DeepSeek / YouTube）。

## 架构要点

- `/api/define`：DeepSeek 释义（可缓存）
- `/api/clips`：YouTube 搜索 + 字幕链（默认 **youtube-transcript.ai → youtube-unofficial**）+ 降级近义词 / 情境短文
- Provider 抽象：`SearchProvider` / `TranscriptProvider` / `VideoClipProvider`，字幕库可整包替换
- 成本护栏：每词 DeepSeek / search / transcript 次数上限 + IP 限流

### 字幕源（Vercel）

默认 `TRANSCRIPT_PROVIDER=chain`：先请求 [youtube-transcript.ai](https://youtube-transcript.ai/youtube-transcript-api)（免 Key、适合机房直连），失败再回退本地/代理可用的 `youtube-unofficial`。该第三方源为 fair-use，无精确公开配额；短时高频请求可能返回限流文案（仍 HTTP 200），应用会记为 `TRANSCRIPT_RATE_LIMIT` 并回退。生产环境请勿配置 `YOUTUBE_HTTPS_PROXY=http://127.0.0.1:…`。在 Vercel 请将 `TRANSCRIPT_PROVIDER` 设为 `chain`（或留空使用默认）。

## 脚本

- `npm run dev` — 本地开发
- `npm run build` — 生产构建
- `npm run start` — 本地预览生产构建

部署到 Vercel 时，在项目 Environment Variables 填入与 `.env.local` 相同的键（不要提交真实密钥）。

## 网络说明（YouTube）

若本机直连 `googleapis.com` / `youtube.com` 超时，请开启本地代理，并用其一：

```bash
export YOUTUBE_HTTPS_PROXY=http://127.0.0.1:7897
npm run dev
```

或在 `.env.local` 增加 `YOUTUBE_HTTPS_PROXY=...`（不要把全局 `HTTPS_PROXY` 强加给 DeepSeek）。应用会**仅对 YouTube/Google 请求**走该代理。
