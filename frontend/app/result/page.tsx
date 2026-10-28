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
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-indigo-600">ResumePilot</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            {match ? "你的匹配报告" : "正在分析…"}
          </h1>
          {file && <p className="mt-1 text-sm text-gray-500">{file.name}</p>}
        </div>
        <button
          onClick={() => { reset(); router.push("/"); }}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          分析另一份简历
        </button>
      </div>

      {warnings.length > 0 && (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {warnings.map((w, i) => <p key={i}>⚠️ {w}</p>)}
        </div>
      )}

      {/* 分析中：优雅的分阶段提示，无内部术语 */}
      {running && (
        <div className="mt-16 flex flex-col items-center gap-5">
          <span className="inline-block h-10 w-10 animate-spin rounded-full border-[3px] border-gray-200 border-t-indigo-500" />
          <p className="text-base font-medium text-gray-700">{STAGE_TIPS[stageIdx]}</p>
          <p className="text-xs text-gray-400">通常需要 10 秒左右，请稍候</p>
        </div>
      )}

      {error && (
        <div className="mt-12 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          <p className="font-semibold">分析没能完成</p>
          <p className="mt-1">{error}</p>
          <button
            onClick={() => { reset(); router.push("/"); }}
            className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
          >
            返回重试
          </button>
        </div>
      )}

      {match && (
        <>
          {/* 总评卡 */}
          <section className="mt-8 overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="grid grid-cols-1 items-center divide-y divide-gray-100 md:grid-cols-2 md:divide-x md:divide-y-0">
              <div className="p-6">
                <ScoreGauge score={match.total_score} />
              </div>
              <div className="flex flex-col items-center p-6">
                <RadarChart scores={match.dimension_scores} />
              </div>
            </div>
            <div className="border-t border-gray-100 bg-gray-50/60 px-6 py-3.5">
              <Verdict score={match.total_score} hits={hits.length} total={match.requirements.length} />
            </div>
          </section>

          {/* 优势 */}
          {hits.length > 0 && (
            <section className="mt-8">
              <h2 className="text-base font-semibold text-gray-900">
                你的优势（{hits.length}）
              </h2>
              <div className="mt-3 space-y-2">
                {hits.map((r, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-3 text-sm">
                    <span className="mt-0.5">✅</span>
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
            <section className="mt-8">
              <h2 className="text-base font-semibold text-gray-900">
                待提升（{gaps.length}）
              </h2>
              <div className="mt-3 space-y-2">
                {gaps.map((r, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm">
                    <span className="mt-0.5">{r.status === "partial" ? "🟡" : "⚪"}</span>
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
            <section className="mt-8">
              <h2 className="text-base font-semibold text-gray-900">
                改进建议{rewrites.length > 0 ? `（${rewrites.length}）` : ""}
              </h2>
              <p className="mt-1 text-xs text-gray-400">
                标 🟡 的条目给出可直接使用的改写；标 ⚪ 的给出补充方向——带 X、N 占位的地方请填入你的真实数据
              </p>
              <div className="mt-4 space-y-4">
                {rewrites.map((r, i) => (
                  <RewriteCard key={i} item={r} />
                ))}
                {progress.rewriter === "running" && (
                  <div className="flex items-center gap-3 rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-4 py-3 text-sm text-gray-400">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-400" />
                    建议生成中…
                  </div>
                )}
              </div>
            </section>
          )}

          {skippedReason && (
            <div className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
              🎉 简历与这个岗位高度匹配，没有需要改进的条目。
            </div>
          )}

          {/* 历史记录：分析完直接回看，不用跳回首页（组件自带标题与上边距） */}
          <HistoryPanel />
        </>
      )}
    </main>
  );
}

function Verdict({ score, hits, total }: { score: number; hits: number; total: number }) {
  let text: string;
  if (score >= 85) text = "简历与岗位高度匹配，可以直接投递。";
  else if (score >= 60) text = "整体匹配不错，补齐下方几条后胜算更大。";
  else if (score >= 35) text = "有基础但差距明显，建议重点打磨待提升项后再投。";
  else text = "目前匹配度较低，如坚持投递请逐条参考改进建议重写相关段落。";
  return (
    <p className="text-center text-sm text-gray-700">
      {text}
      <span className="ml-2 text-xs text-gray-400">
        {hits}/{total} 条岗位要求已满足
      </span>
    </p>
  );
}
