"use client";

import type { RewriteSuggestion } from "@/lib/types";

/** 改写建议卡片：直接可用（基于现有内容）与补充方向（占位模板）两种形态 */
export default function RewriteCard({ item }: { item: RewriteSuggestion }) {
  const isGuidance = item.was_status === "miss";
  return (
    <div
      className="rounded-xl border border-gray-200 bg-white p-5"
      style={{ animation: "fadeSlideIn 0.4s ease" }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-gray-900">{item.for_requirement}</p>
        <span
          className={`shrink-0 rounded-md border px-2 py-0.5 text-xs ${
            isGuidance
              ? "border-gray-200 bg-gray-50 text-gray-500"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {isGuidance ? "⚪ 补充方向" : "🟡 直接可用"}
        </span>
      </div>

      {!isGuidance && (
        <div className="mt-4 space-y-3 text-sm">
          <div className="rounded-lg bg-gray-50 px-3.5 py-2.5">
            <p className="text-xs font-medium text-gray-400">现在这样写</p>
            <p className="mt-1 text-gray-600">{item.original}</p>
          </div>
          <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 px-3.5 py-2.5">
            <p className="text-xs font-medium text-emerald-600">建议改成</p>
            <p className="mt-1 leading-relaxed text-gray-900">{item.rewritten}</p>
          </div>
          <p className="text-xs leading-relaxed text-gray-500">💡 {item.reason}</p>
        </div>
      )}

      {isGuidance && (
        <div className="mt-4 space-y-3 text-sm">
          <div className="rounded-lg border border-gray-200 bg-white px-3.5 py-2.5">
            <p className="text-xs font-medium text-gray-400">建议补充</p>
            <p className="mt-1 leading-relaxed text-gray-900">{item.rewritten}</p>
          </div>
          <p className="text-xs leading-relaxed text-gray-500">💡 {item.reason}</p>
        </div>
      )}

      <ValidationBanner validation={item.validation} />
    </div>
  );
}

const LEVEL_META = {
  fatal: { icon: "⛔", cls: "border-red-200 bg-red-50 text-red-700", label: "事实风险" },
  warning: { icon: "⚠️", cls: "border-amber-200 bg-amber-50 text-amber-800", label: "请核实" },
  notice: { icon: "💡", cls: "border-blue-100 bg-blue-50 text-blue-700", label: "提示" },
} as const;

function ValidationBanner({ validation }: { validation?: RewriteSuggestion["validation"] }) {
  if (!validation || validation.risk === "ok" || validation.issues.length === 0) return null;
  return (
    <div className={`mt-3 space-y-1.5 rounded-lg border px-3.5 py-2.5 ${LEVEL_META[validation.risk].cls}`}>
      {validation.issues.slice(0, 3).map((issue, i) => (
        <p key={i} className="text-xs leading-relaxed">
          {LEVEL_META[issue.level].icon} {issue.detail}
        </p>
      ))}
    </div>
  );
}
