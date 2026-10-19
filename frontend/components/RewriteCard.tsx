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
    </div>
  );
}
