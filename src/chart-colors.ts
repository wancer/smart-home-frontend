export type ChartColor = { border: string; background: string };

export const CHART_COLORS: Record<string, ChartColor> = {
  power:         { border: "#ef4444", background: "rgba(239,68,68,0.15)" },
  powerConsumed: { border: "#7c3aed", background: "rgba(124,58,237,0.7)" },
  current:       { border: "#f43f5e", background: "rgba(244,63,94,0.15)" },
  voltage:       { border: "#64748b", background: "rgba(100,116,139,0.15)" },
  temperature:   { border: "#f97316", background: "rgba(249,115,22,0.15)" },
  humidity:      { border: "#06b6d4", background: "rgba(6,182,212,0.1)" },
  co2:           { border: "#3b82f6", background: "rgba(59,130,246,0.15)" },
  pressure:      { border: "#84cc16", background: "rgba(132,204,22,0.15)" },
  dcPower:       { border: "#eab308", background: "rgba(234,179,8,0.15)" },
  dcCurrent:     { border: "#6366f1", background: "rgba(99,102,241,0.15)" },
  dcVoltage:     { border: "#ec4899", background: "rgba(236,72,153,0.15)" },
  chip:          { border: "#a855f7", background: "rgba(168,85,247,0.15)" },
  online:        { border: "#22c55e", background: "rgba(34,197,94,0.25)" },
};
