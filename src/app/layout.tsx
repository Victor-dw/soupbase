import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "汤底 · 迷雾侦探社",
  description: "Jev 坐堂的海龟汤。DeepSeek 现煮无限题库。",
  icons: { icon: "/favicon.svg" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body>{children}</body>
    </html>
  );
}
