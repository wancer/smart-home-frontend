"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Line } from "react-chartjs-2";
import { InteractionMode } from "chart.js";
import HttpApi from "../api/http.ts";
import DeviceEvent from "../api/types/device.ts";
import SensorEventStat from "../api/types/sensor-event-stat.ts";
import { SensorEvent } from "../api/types/ws-event.ts";
import { CHART_COLORS } from "../chart-colors.ts";

const BUCKET_S = 300;

type ChipTemperatureProperties = {
  api: HttpApi;
  device: DeviceEvent;
  latestSensorEvent: SensorEvent | null;
};

type Point = { time: number; value: number | null; count: number };

function fmtTime(unix: number): string {
  return new Date(unix * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Adds a live reading to the last 5-minute bucket (or opens a new one). */
function upsert(points: Point[], time: number, value: number): Point[] {
  const bucket = Math.floor(time / BUCKET_S) * BUCKET_S;
  const last = points.at(-1);
  if (last && last.time === bucket) {
    const count = last.count + 1;
    const avg = last.value == null ? value : (last.value * last.count + value) / count;
    return [...points.slice(0, -1), { time: bucket, value: avg, count }];
  }
  if (!last || bucket > last.time) {
    return [...points, { time: bucket, value, count: 1 }];
  }
  return points;
}

/**
 * ESP32 chip temperature (Tasmota SetOption146 1) for the last 24 h. Mounted by the device
 * page while the chart toggle in the config button line is on (devices with "store chip
 * temperature" only; mount with key={device.id}). The current value lives in the hardware popup.
 */
export default function ChipTemperature({ api, device, latestSensorEvent }: ChipTemperatureProperties) {
  const { t } = useTranslation();
  const [points, setPoints] = useState<Point[] | undefined>(undefined);

  useEffect(() => {
    api.sensorsConfigurable(device.id, "24h", "5m").then((stats: SensorEventStat[]) =>
      // the API labels a step with its end; live readings are keyed by bucket start
      setPoints(stats.map(s => ({ time: s.time - BUCKET_S, value: s.chipTemperatureAvg ?? null, count: 1 }))),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const e = latestSensorEvent;
    if (!e || e.deviceId !== device.id || e.chipTemperature == null) return;
    const value = e.chipTemperature;
    setPoints(prev => prev ? upsert(prev, e.time, value) : prev);
  }, [latestSensorEvent]);

  return (
    <div className="row mb-3">
      <h5 className="text-secondary">
        <i className="fa fa-microchip me-2"></i>{t("devicePage.chipTemperatureChart")}
      </h5>
      {points === undefined
        ? <div className="text-center py-4"><div className="spinner-border spinner-border-sm" role="status"></div></div>
        : <ChartChipTemperature points={points} label={t("devicePage.chipTemperature")} />}
    </div>
  );
}

function ChartChipTemperature({ points, label }: { points: Point[]; label: string }) {
  const data = {
    labels: points.map(p => fmtTime(p.time)),
    datasets: [
      {
        label: `${label}, °C`,
        borderColor: CHART_COLORS.chip.border,
        backgroundColor: CHART_COLORS.chip.background,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        spanGaps: false,
        data: points.map(p => (p.value != null ? +p.value.toFixed(1) : null)),
      },
    ],
  };
  const options = {
    responsive: true,
    animation: { duration: 0 },
    interaction: { mode: "index" as InteractionMode, intersect: false },
    plugins: {
      tooltip: { mode: "index" as InteractionMode, intersect: false },
    },
    scales: {
      x: { ticks: { maxTicksLimit: 12, maxRotation: 0 } },
      y: { title: { display: true, text: "°C" } },
    },
  };

  return <Line data={data} options={options} />;
}
