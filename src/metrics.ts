import type { DashboardView } from "./api/types/device";
import { CHART_COLORS, ChartColor } from "./chart-setup";

/**
 * Every sensor value the backend can report. The same key is used in device state and live
 * sensor events, and with an Avg/Min/Max suffix in chart points. null = not reported.
 *
 * voltage/current/power are AC energy-meter values; dcVoltage/dcCurrent/dcPower come from an
 * INA219 and are kept apart everywhere (own tiles, own charts).
 */
export type MetricKey =
  | "power" | "current" | "voltage"
  | "temperature" | "humidity" | "co2"
  | "pressure"
  | "dcPower" | "dcCurrent" | "dcVoltage";

export type MetricValues = Record<MetricKey, number | null>;

export type Metric = {
  key: MetricKey;
  unit: string;
  /** Short qualifier shown next to the unit, so DC values can't be mistaken for AC ones. */
  tag?: string;
  /** Decimal places to show; undefined = as reported. */
  precision?: number;
  color: ChartColor;
  /** Fixed y-axis bounds for charts. */
  axisMin?: number;
  axisMax?: number;
  /** Dataset label in charts. */
  chartLabel: string;
};

/** In display order (tiles, chart series). */
export const METRICS: Metric[] = [
  { key: "power",       unit: "W",   color: CHART_COLORS.power,       chartLabel: "W", axisMin: 0 },
  { key: "current",     unit: "A",   color: CHART_COLORS.current,     chartLabel: "A" },
  { key: "voltage",     unit: "V",   color: CHART_COLORS.voltage,     chartLabel: "V" },
  { key: "temperature", unit: "°C",  color: CHART_COLORS.temperature, chartLabel: "°C" },
  { key: "humidity",    unit: "%",   color: CHART_COLORS.humidity,    chartLabel: "H₂O %", axisMin: 0, axisMax: 100 },
  { key: "co2",         unit: "ppm", color: CHART_COLORS.co2,         chartLabel: "CO₂ ppm", axisMin: 400 },
  { key: "pressure",    unit: "hPa", precision: 1, color: CHART_COLORS.pressure, chartLabel: "hPa" },
  { key: "dcPower",     unit: "W", tag: "DC", precision: 2, color: CHART_COLORS.dcPower,   chartLabel: "W DC", axisMin: 0 },
  { key: "dcCurrent",   unit: "A", tag: "DC", precision: 3, color: CHART_COLORS.dcCurrent, chartLabel: "A DC" },
  { key: "dcVoltage",   unit: "V", tag: "DC", precision: 2, color: CHART_COLORS.dcVoltage, chartLabel: "V DC" },
];

export const METRIC_BY_KEY = Object.fromEntries(METRICS.map(m => [m.key, m])) as Record<MetricKey, Metric>;

export function formatMetric(m: Metric, value: number): string {
  return m.precision === undefined ? String(value) : value.toFixed(m.precision);
}

/** Reads key from a decoded payload; missing = null. */
export function readMetrics(decoded: Record<string, unknown> | null | undefined): MetricValues {
  const values = {} as MetricValues;
  for (const m of METRICS) {
    const v = decoded?.[m.key];
    values[m.key] = typeof v === "number" ? v : null;
  }
  return values;
}

/** Metrics with a value, in display order. */
export function reportedMetrics(values: MetricValues): Metric[] {
  return METRICS.filter(m => values[m.key] != null);
}

// Which value the dashboard sparkline follows: the first one the device reports.
const SPARKLINE_ORDER: MetricKey[] = [
  "power", "co2", "temperature", "dcPower", "pressure", "humidity", "dcCurrent", "dcVoltage", "current", "voltage",
];

export function sparklineMetric(values: MetricValues): Metric | null {
  const key = SPARKLINE_ORDER.find(k => values[k] != null);
  return key ? METRIC_BY_KEY[key] : null;
}

/** The dashboard chart metric: the chosen one, or the auto one (`fallback` when the state has none); null = no chart. */
export function dashboardChartMetric(view: DashboardView, values: MetricValues, fallback?: MetricValues): Metric | null {
  if (view.chart === "none") return null;
  if (view.chart !== "") return METRIC_BY_KEY[view.chart] ?? null;
  return sparklineMetric(values) ?? (fallback ? sparklineMetric(fallback) : null);
}

/** The dashboard values with a value: the chosen ones (in the chosen order), or every reported one. */
export function dashboardMetrics(view: DashboardView, values: MetricValues): Metric[] {
  if (view.values === null) return reportedMetrics(values);
  return view.values.map(k => METRIC_BY_KEY[k]).filter(m => m && values[m.key] != null);
}

/** Charts on the device page; each shows up to two metrics (left and right axis). */
export type ChartGroup = { id: string; labelKey: string; metrics: [MetricKey] | [MetricKey, MetricKey] };

export const CHART_GROUPS: ChartGroup[] = [
  { id: "power",    labelKey: "devicePage.chart_power",    metrics: ["power"] },
  { id: "co2",      labelKey: "devicePage.chart_co2",      metrics: ["co2"] },
  { id: "th",       labelKey: "devicePage.chart_th",       metrics: ["temperature", "humidity"] },
  { id: "pressure", labelKey: "devicePage.chart_pressure", metrics: ["pressure"] },
  { id: "dcPower",  labelKey: "devicePage.chart_dcPower",  metrics: ["dcPower"] },
  { id: "dcVI",     labelKey: "devicePage.chart_dcVI",     metrics: ["dcVoltage", "dcCurrent"] },
];
