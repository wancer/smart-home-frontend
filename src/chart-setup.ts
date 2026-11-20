import {
  Chart as ChartJS,
  BarController,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from "chart.js";

// Every Chart.js component the app uses, registered once (import this module before drawing a chart).
ChartJS.register(
  BarController,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Title,
  Tooltip,
);

export type ChartColor = { border: string; background: string };

export const CHART_COLORS: Record<string, ChartColor> = {
  power:         { border: "#ef4444", background: "rgba(239,68,68,0.15)" },
  powerConsumed: { border: "#7c3aed", background: "rgba(124,58,237,0.7)" },
  temperature:   { border: "#f97316", background: "rgba(249,115,22,0.15)" },
  humidity:      { border: "#06b6d4", background: "rgba(6,182,212,0.1)" },
  co2:           { border: "#3b82f6", background: "rgba(59,130,246,0.15)" },
  chip:          { border: "#a855f7", background: "rgba(168,85,247,0.15)" },
  online:        { border: "#22c55e", background: "rgba(34,197,94,0.25)" },
};

/** Tooltip listing every series at the hovered x position. */
export const indexTooltip = { mode: "index" as const, intersect: false };

/** Common options of the time-series line charts: no animation (they update live), hover by x. */
export const lineChartBase = {
  responsive: true,
  animation: { duration: 0 },
  interaction: indexTooltip,
};

export const timeAxis = {
  ticks: {
    maxTicksLimit: 12,
    maxRotation: 0,
  },
};
