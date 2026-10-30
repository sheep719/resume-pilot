"use client";

/** 四维雷达图：纯 SVG（渐变数据面 + 顶点圆点），零依赖 */
const DIMS = [
  { key: "hard_skill", label: "硬技能" },
  { key: "project", label: "项目经历" },
  { key: "education", label: "学历门槛" },
  { key: "bonus", label: "加分项" },
];

export default function RadarChart({ scores }: { scores: Record<string, number> }) {
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const R = 76;

  // 四维 → 正四边形（上/右/下/左）
  const angle = (i: number) => (Math.PI / 2) * i + Math.PI / 2; // 起点在上
  const pt = (i: number, r: number) => {
    const a = angle(i);
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)] as const;
  };

  const valueOf = (key: string) => Math.max(0, Math.min(100, scores[key] ?? 0));
  const dataPts = DIMS.map((d, i) => ({ d, ...pt(i, (R * valueOf(d.key)) / 100), v: valueOf(d.key) }));
  const poly = dataPts.map((p) => `${p[0]} ${p[1]}`).join(" ");
  const gridRing = (f: number) => DIMS.map((_, i) => pt(i, R * f).join(" ")).join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-56">
      <defs>
        <radialGradient id="radarFill" cx="50%" cy="50%" r="65%">
          <stop offset="0%" stopColor="#818cf8" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.18" />
        </radialGradient>
      </defs>

      {/* 网格（虚线，最外环实线） */}
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon
          key={f}
          points={gridRing(f)}
          fill="none"
          stroke={f === 1 ? "#e5e7eb" : "#f3f4f6"}
          strokeWidth="1"
          strokeDasharray={f === 1 ? undefined : "3 4"}
        />
      ))}
      {DIMS.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#f3f4f6" strokeWidth="1" />;
      })}

      {/* 数据面（渐变 + 描边） */}
      <polygon
        points={poly}
        fill="url(#radarFill)"
        stroke="#6366f1"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* 顶点圆点 */}
      {dataPts.map((p) => (
        <circle key={p.d.key} cx={p[0]} cy={p[1]} r="3.5" fill="#6366f1" stroke="#fff" strokeWidth="1.5" />
      ))}

      {/* 维度标签 + 分数 */}
      {DIMS.map((d, i) => {
        const [x, y] = pt(i, R + 19);
        return (
          <text key={d.key} x={x} y={y} textAnchor="middle" dominantBaseline="central"
            fontSize="11" fill="#4b5563" fontWeight="500">
            {d.label}
            <tspan x={x} dy="13" fill="#9ca3af" fontSize="10" fontWeight="400" className="tabular">
              {valueOf(d.key).toFixed(0)}
            </tspan>
          </text>
        );
      })}
    </svg>
  );
}
