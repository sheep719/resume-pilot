"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAnalysis } from "@/lib/store";
import ScoreGauge from "@/components/ScoreGauge";
import RadarChart from "@/components/RadarChart";
import RewriteCard from "@/components/RewriteCard";
import HistoryPanel from "@/components/HistoryPanel";
import type { JDRequirement } from "@/lib/types";

const STAGE_TIPS = [
  "正在阅读你的简历…",
  "正在逐条比对岗位要求…",
  "正在为你打磨改进建议…",
];

export default function ResultPage() {
  const {
    start, reset, started, progress, warnings, match,
    rewrites, skippedReason, error, finished, file,
  } = useAnalysis();
  const router = useRouter();

  useEffect(() => {
    if (!started) {
      if (!file) {
        router.replace("/");
        return;
      }
      start();
    }
  }, [started, file, start, router]);

  const running = !finished && !error;
  const stageIdx = progress.matcher === "done" ? 2
    : progress.matcher === "running" ? 1 : 0;

  const hits = match?.requirements.filter((r) => r.status === "hit") ?? [];
  const gaps = match?.requirements.filter((r) => r.status !== "hit") ?? [];

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      {/* 顶栏 */}
      <header className="animate-fade-slide flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-sm shadow-indigo-200">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
                <path d="M9 15l2 2 4-4" />
              </svg>
            </span>
            <span className="text-xs font-semibold tracking-wide text-indigo-600">ResumePilot</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-gray-900">
            {match ? "你的匹配报告" : "正在分析…"}
          </h1>
          {file && <p className="mt-1 text-sm text-gray-400">{file.name}</p>}
        </div>
        <button
          onClick={() => { reset(); router.push("/"); }}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white/80 px-3.5 py-2 text-sm text-gray-600 shadow-sm transition hover:border-gray-300 hover:bg-white hover:text-gray-900"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
          分析另一份
        </button>
      </header>

      {warnings.length > 0 && (
        <div className="animate-fade-slide mt-6 rounded-xl border border-amber-200/70 bg-amber-50/80 px-4 py-3 text-sm text-amber-800">
          {warnings.map((w, i) => <p key={i}>⚠️ {w}</p>)}
        </div>
      )}

      {/* 分析中：阶段提示 + 进度条 + 三点跳动 */}
      {running && (
        <div className="mt-20 flex flex-col items-center gap-6">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-2.5 w-2.5 rounded-full bg-indigo-400"
                style={{ animation: `dotBounce 1.2s ${i * 0.18}s ease-in-out infinite` }}
              />
            ))}
          </div>
          <div className="w-full max-w-xs">
            <div className="h-1.5 overflow-hidden rounded-full bg-gray-200/70">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-700"
                style={{ width: `${((stageIdx + 1) / 3) * 100}%` }}
              />
            </div>
          </div>
          <div className="text-center">
            <p className="text-base font-medium text-gray-700">{STAGE_TIPS[stageIdx]}</p>
            <p className="mt-1.5 text-xs text-gray-400">通常需要 10 秒左右，请稍候</p>
          </div>
        </div>
      )}

      {error && (
        <div className="animate-fade-slide mt-12 rounded-2xl border border-red-200 bg-red-50/80 px-6 py-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-600">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4" />
                <path d="M12 16h.01" />
              </svg>
            </span>
            <div className="flex-1">
              <p className="font-semibold text-red-800">分析没能完成</p>
              <p className="mt-1 text-sm leading-relaxed text-red-600">{error}</p>
              <button
                onClick={() => { reset(); router.push("/"); }}
                className="mt-4 rounded-lg border border-red-200 bg-white px-3.5 py-1.5 text-xs font-medium text-red-600 shadow-sm transition hover:bg-red-50"
              >
                返回重试
              </button>
            </div>
          </div>
        </div>
      )}

      {match && (
        <>
          {/* 总评卡 */}
          <section className="animate-fade-slide mt-8 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="grid grid-cols-1 items-center divide-y divide-gray-100 md:grid-cols-2 md:divide-x md:divide-y-0">
              <div className="p-6">
                <ScoreGauge score={match.total_score} />
              </div>
              <div className="flex flex-col items-center p-6">
                <RadarChart scores={match.dimension_scores} />
              </div>
            </div>
            <div className="border-t border-gray-100 bg-gradient-to-r from-indigo-50/60 via-gray-50/80 to-violet-50/50 px-6 py-4">
              <Verdict score={match.total_score} hits={hits.length} total={match.requirements.length} />
            </div>
          </section>

          {/* 优势 */}
          {hits.length > 0 && (
            <section className="animate-fade-slide mt-8" style={{ animationDelay: "0.08s" }}>
              <SectionTitle icon="✅" iconBg="bg-emerald-50" title={`你的优势（${hits.length}）`} />
              <div className="stagger mt-3 space-y-2">
                {hits.map((r, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-xl border border-emerald-100/80 bg-emerald-50/40 px-4 py-3 text-sm transition hover:bg-emerald-50/70">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs">✓</span>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800">{r.requirement}</p>
                      {r.evidence && (
                        <p className="mt-1 truncate text-xs text-gray-500">你的简历依据：{r.evidence}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 差距 */}
          {gaps.length > 0 && (
            <section className="animate-fade-slide mt-8" style={{ animationDelay: "0.12s" }}>
              <SectionTitle icon="🎯" iconBg="bg-amber-50" title={`待提升（${gaps.length}）`} />
              <div className="stagger mt-3 space-y-2">
                {gaps.map((r, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 text-sm shadow-sm transition hover:border-gray-200">
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                      r.status === "partial" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-400"
                    }`}>
                      {r.status === "partial" ? "◐" : "○"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-800">{r.requirement}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {r.status === "partial" ? "简历有相关内容，但深度或证据不够突出" : "简历中还没有体现这条要求"}
                      </p>
                      {r.status === "partial" && r.evidence && (
                        <p className="mt-1 truncate text-xs text-gray-400">你的简历依据：{r.evidence}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 改进建议 */}
          {!skippedReason && (
            <section className="animate-fade-slide mt-8" style={{ animationDelay: "0.16s" }}>
              <SectionTitle
                icon="✨" iconBg="bg-indigo-50"
                title={`改进建议${rewrites.length > 0 ? `（${rewrites.length}）` : ""}`}
              />
              <p className="mt-2 text-xs leading-relaxed text-gray-400">
                标 🟡 的条目给出可直接使用的改写；标 ⚪ 的给出补充方向——带 X、N 占位的地方请填入你的真实数据
              </p>
              <div className="stagger mt-4 space-y-4">
                {rewrites.map((r, i) => (
                  <RewriteCard key={i} item={r} />
                ))}
                {progress.rewriter === "running" && (
                  <div className="flex items-center gap-3 rounded-xl border border-dashed border-gray-200 bg-white/60 px-4 py-3 text-sm text-gray-400">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-400" />
                    建议生成中…
                  </div>
                )}
              </div>
            </section>
          )}

          {skippedReason && (
            <div className="animate-fade-slide mt-8 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 px-6 py-5 text-sm text-emerald-800 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-lg">🎉</span>
                <p className="font-medium">简历与这个岗位高度匹配，没有需要改进的条目。</p>
              </div>
            </div>
          )}

          {/* 历史记录（组件自带标题与上边距） */}
          <HistoryPanel />
        </>
      )}
    </main>
  );
}

function SectionTitle({ icon, iconBg, title }: { icon: string; iconBg: string; title: string }) {
  return (
    <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
      <span className={`flex h-6 w-6 items-center justify-center rounded-lg text-sm ${iconBg}`}>
        {icon}
      </span>
      {title}
    </h2>
  );
}

function Verdict({ score, hits, total }: { score: number; hits: number; total: number }) {
  let text: string;
  if (score >= 85) text = "简历与岗位高度匹配，可以直接投递。";
  else if (score >= 60) text = "整体匹配不错，补齐下方几条后胜算更大。";
  else if (score >= 35) text = "有基础但差距明显，建议重点打磨待提升项后再投。";
  else text = "目前匹配度较低，如坚持投递请逐条参考改进建议重写相关段落。";
  return (
    <p className="text-center text-sm leading-relaxed text-gray-700">
      {text}
      <span className="ml-2 text-xs tabular text-gray-400">
        {hits}/{total} 条岗位要求已满足
      </span>
    </p>
  );
}
