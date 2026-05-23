type ChartColor = { border: string; background: string };

export const CHART_COLORS: Record<string, ChartColor> = {
  power:         { border: "#ef4444", background: "rgba(239,68,68,0.15)" },
  powerConsumed: { border: "#7c3aed", background: "rgba(124,58,237,0.7)" },
  temperature:   { border: "#f97316", background: "rgba(249,115,22,0.15)" },
  humidity:      { border: "#06b6d4", background: "rgba(6,182,212,0.1)" },
  co2:           { border: "#3b82f6", background: "rgba(59,130,246,0.15)" },
  eco2:          { border: "#10b981", background: "rgba(16,185,129,0.15)" },
  online:        { border: "#22c55e", background: "rgba(34,197,94,0.25)" },
};
