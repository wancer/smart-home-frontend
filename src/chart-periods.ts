import DeviceEvent from "./api/types/device";
import { STORAGE_STEPS } from "./element/storage-tiers-editor";

const HOUR = 3600;
const DAY = 86400;

/** A device chart's period: `window` seconds of data in points of `step` seconds (0 = every raw reading). */
export type ChartPeriod = { window: number; step: number };

// A chart never asks for more points than this; the step is raised to fit.
const MAX_POINTS = 1500;
// Each tier is charted over the longest of these windows that its step shows in at most
// TIER_POINTS points (raw → 1 h, 1 min → 6 h, 5 min → 1 d, 1 h → 7 d, 1 d → 365 d), not
// over its whole keep time: older pages of the same window are reached with prev/next.
const TIER_POINTS = 400;
const TIER_WINDOWS = [HOUR, 6 * HOUR, DAY, 7 * DAY, 30 * DAY, 365 * DAY];
// Raw readings (every TelePeriod, possibly every few seconds) are only charted up to this window.
const RAW_WINDOW = HOUR;

const BUCKET_STEPS = STORAGE_STEPS.filter(s => s > 0);

// fitStep is the finest step not finer than the stored one that keeps the chart within
// MAX_POINTS. Raw data is shown raw only for short windows.
function fitStep(window: number, storedStep: number): number {
  if (storedStep === 0 && window <= RAW_WINDOW) return 0;
  return BUCKET_STEPS.find(s => s >= storedStep && window / s <= MAX_POINTS) ?? DAY;
}

// tierWindow is the window a tier's step reads well in, at most its keep time.
function tierWindow(step: number, keep: number): number {
  const fitting = TIER_WINDOWS.filter(w => step === 0 ? w <= RAW_WINDOW : w / step <= TIER_POINTS);
  const window = fitting.at(-1) ?? TIER_WINDOWS[0];
  return keep > 0 ? Math.min(window, keep) : window;
}

/**
 * The chart periods offered for a device, from its storage tiers: one per tier, sized to
 * that tier's step (e.g. raw 1 d → 5 min 30 d → 1 h ∞ gives 1 h raw, 1 d of 5 min, 7 d of
 * 1 h). A tier whose window is not longer than the previous one adds nothing. If every
 * window is under a day but data is kept longer, a 1-day view is added.
 */
export function chartPeriods(device: DeviceEvent): ChartPeriod[] {
  const periods: ChartPeriod[] = [];
  for (const tier of device.storageTiers) {
    const window = tierWindow(tier.step, tier.keep);
    if (periods.length === 0 || window > periods[periods.length - 1].window) {
      periods.push({ window, step: fitStep(window, tier.step) });
    }
  }
  const last = device.storageTiers.at(-1);
  const longest = periods.at(-1)?.window ?? 0;
  if (last && longest < DAY && (last.keep === 0 || last.keep >= DAY)) {
    periods.push({ window: DAY, step: fitStep(DAY, last.step) });
  }
  return periods;
}

/** The period shown first: 24 h if offered, else the shortest one of at least a day. */
export function defaultPeriodIndex(periods: ChartPeriod[]): number {
  const day = periods.findIndex(p => p.window === DAY);
  if (day >= 0) return day;
  const longer = periods.findIndex(p => p.window >= DAY);
  return longer >= 0 ? longer : periods.length - 1;
}

/**
 * Where page `offset` ends (unix seconds); undefined for offset 0, the live page ending
 * now. Earlier pages are whole hours (windows under a day) or whole local days, so page 1
 * of a 24 h chart is yesterday.
 */
export function pageEnd(window: number, offset: number): number | undefined {
  if (offset === 0) return undefined;
  const d = new Date();
  if (window < DAY) {
    d.setMinutes(0, 0, 0);
    return Math.floor(d.getTime() / 1000) - (offset - 1) * window;
  }
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (offset - 1) * Math.round(window / DAY));
  return Math.floor(d.getTime() / 1000);
}

/** "18.11, 13:00 – 14:00", "18.11.2026" or "12.11.2026 – 18.11.2026". */
export function pageLabel(window: number, end: number): string {
  const from = new Date((end - window) * 1000);
  if (window < DAY) {
    const time: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
    return `${from.toLocaleString([], { day: "2-digit", month: "2-digit", ...time })} – ${new Date(end * 1000).toLocaleTimeString([], time)}`;
  }
  const last = new Date((end - 1) * 1000).toLocaleDateString();
  return window === DAY ? last : `${from.toLocaleDateString()} – ${last}`;
}

/** Chart x labels: time (with seconds for raw readings), prefixed by the date for windows over a day. */
export function chartLabels(times: number[], window: number): string[] {
  const seconds = times.some(t => t % 60 !== 0);
  const daily = times.length > 1 && times[1] - times[0] >= DAY;
  const time: Intl.DateTimeFormatOptions = seconds
    ? { hour: "2-digit", minute: "2-digit", second: "2-digit" }
    : { hour: "2-digit", minute: "2-digit" };
  return times.map(t => {
    const d = new Date(t * 1000);
    if (window <= DAY) return d.toLocaleTimeString([], time);
    const date = d.toLocaleDateString([], { day: "2-digit", month: "2-digit" });
    return daily ? date : `${date} ${d.toLocaleTimeString([], time)}`;
  });
}
