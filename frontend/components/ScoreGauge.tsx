"use client";

/** 总分仪表盘：纯 SVG 半圆环（渐变弧 + 刻度），零图表依赖 */
export default function ScoreGauge({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score));
  const R = 80;
  const C = Math.PI * R; // 半圆弧长

  // 分档渐变：低分红 → 中分琥珀 → 高分翠绿
  const gradId = "gaugeGrad";
  const stops =
    pct >= 70
      ? [["0%", "#34d399"], ["100%", "#059669"]]
      : pct >= 40
        ? [["0%", "#fbbf24"], ["100%", "#d97706"]]
        : [["0%", "#f87171"], ["100%", "#dc2626"]];

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 118" className="w-56">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
            {stops.map(([off, color]) => (
              <stop key={off} offset={off} stopColor={color} />
            ))}
          </linearGradient>
        </defs>

        {/* 底轨 */}
        <path
          d={`M 20 100 A ${R} ${R} 0 0 1 180 100`}
          fill="none" stroke="#f3f4f6" strokeWidth="14" strokeLinecap="round"
        />

        {/* 刻度（0/50/100 三个小点） */}
        {[0, 50, 100].map((v) => {
          const a = Math.PI - (v / 100) * Math.PI;
          const x = 100 + (R + 14) * Math.cos(a);
          const y = 100 - (R + 14) * Math.sin(a);
          return <circle key={v} cx={x} cy={y} r="1.5" fill="#d1d5db" />;
        })}

        {/* 数值弧（渐变） */}
        <path
          d={`M 20 100 A ${R} ${R} 0 0 1 180 100`}
          fill="none" stroke={`url(#${gradId})`} strokeWidth="14" strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * C} ${C}`}
          style={{ transition: "stroke-dasharray 0.9s cubic-bezier(0.22, 1, 0.36, 1)" }}
        />

        <text x="100" y="78" textAnchor="middle" dominantBaseline="central"
          fontSize="42" fontWeight="700" fill="#111827" className="tabular">
          {pct.toFixed(0)}
        </text>
        <text x="100" y="103" textAnchor="middle" fontSize="11" fill="#9ca3af">
          / 100 匹配度
        </text>
      </svg>
    </div>
  );
}
