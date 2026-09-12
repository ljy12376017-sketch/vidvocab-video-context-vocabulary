import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VidVocab · 视频语境背单词",
  description: "通过真实视频语境学单词，轻松搞笑，不严肃教培。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
