import type { Metadata } from "next";
import { AnalysisProvider } from "@/lib/store";
import "./globals.css";

export const metadata: Metadata = {
  title: "ResumePilot · 简历优化多 Agent 工具",
  description: "上传简历 + 目标 JD，三个 Agent 协作给出匹配度评分与逐段改写建议",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-[#f7f8fc] text-gray-900 antialiased">
        {/* 背景质感：极浅渐变 + 两团缓慢浮动的 indigo 光斑（纯 CSS，零资源） */}
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-50/70 via-[#f7f8fc] to-[#f7f8fc]" />
          <div
            className="absolute -top-32 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-indigo-200/30 blur-3xl"
            style={{ animation: "drift 18s ease-in-out infinite" }}
          />
          <div
            className="absolute top-1/3 -right-24 h-72 w-72 rounded-full bg-sky-200/25 blur-3xl"
            style={{ animation: "drift 24s ease-in-out infinite reverse" }}
          />
        </div>
        <AnalysisProvider>{children}</AnalysisProvider>
      </body>
    </html>
  );
}
