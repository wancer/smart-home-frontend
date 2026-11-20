import { TFunction } from "i18next";

const MINUTE = 60;
const HOUR = 3600;
const DAY = 86400;

/** In the largest whole unit: "30 s", "5 min", "2 h", "1 d". */
export function formatDuration(t: TFunction, seconds: number): string {
  if (seconds % DAY === 0) return t("duration.days", { count: seconds / DAY });
  if (seconds % HOUR === 0) return t("duration.hours", { count: seconds / HOUR });
  if (seconds % MINUTE === 0) return t("duration.minutes", { count: seconds / MINUTE });
  return t("duration.seconds", { count: seconds });
}

/** A running clock: 10208 -> "2h 50m 08s", 183600 -> "2d 3h 00m 00s". */
export function formatElapsed(totalSec: number): string {
  const d = Math.floor(totalSec / DAY);
  const h = Math.floor(totalSec % DAY / HOUR);
  const m = Math.floor(totalSec % HOUR / MINUTE);
  const s = totalSec % MINUTE;
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (d > 0) return `${d}d ${h}h ${pad(m)}m ${pad(s)}s`;
  if (h > 0) return `${h}h ${pad(m)}m ${pad(s)}s`;
  return `${m}m ${pad(s)}s`;
}
