"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { Col } from "react-bootstrap";
import DeviceConfigPanel from "../element/device-config-panel.tsx";
import { Bar, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineController,
  LinearScale,
  CategoryScale,
  BarController,
  BarElement,
  PointElement,
  LineElement,
  Filler,
  Legend,
  Title,
  Tooltip,
  InteractionMode,
} from "chart.js";

ChartJS.register(
  LineController,
  LinearScale,
  CategoryScale,
  BarController,
  BarElement,
  PointElement,
  LineElement,
  Legend,
  Tooltip,
  Filler,
  Title,
);

import DeviceEvent from "../api/types/device.ts";
import { CHART_COLORS } from "../chart-colors.ts";
import HttpApi from "../api/http.ts";
import SensorDailyEvent from "../api/types/sensor-daily.ts";
import SensorEventStat from "../api/types/sensor-event-stat.ts";
import { SensorEvent } from "../api/types/ws-event.ts";
import PowerIcon from "../element/power-icon.tsx";

type DevicePageProperties = {
  api: HttpApi;
  devices: DeviceEvent[];
  latestSensorEvent: SensorEvent | null;
};

function weightedAvg(prev: number | null | undefined, next: number, n: number): number {
  if (n === 1 || prev == null) return next;
  return (prev * (n - 1) + next) / n;
}

function buildBucketStat(bucketTime: number, e: SensorEvent, prev: SensorEventStat | null, n: number, device: DeviceEvent): SensorEventStat {
  const stat: any = {
    time: bucketTime,
    powerConsumed: prev?.powerConsumed ?? null,
    powerAvg: null,
    currentAvg: null,
    voltageAvg: null,
    co2Avg: null,
    co2eAvg: null,
    temperatureAvg: null,
    humidityAvg: null,
  };

  if (device.isEnergySensor()) {
    stat.powerAvg   = weightedAvg(prev?.powerAvg,   e.power,   n);
    stat.currentAvg = weightedAvg(prev?.currentAvg, e.current, n);
    stat.voltageAvg = weightedAvg(prev?.voltageAvg, e.voltage, n);
  }

  if (device.isCo2Sensor()) {
    stat.co2Avg  = weightedAvg(prev?.co2Avg,  e.co2,  n);
    stat.co2eAvg = weightedAvg(prev?.co2eAvg, e.co2e, n);
  }

  if (device.isCo2Sensor() || device.isThSensor()) {
    stat.temperatureAvg = weightedAvg(prev?.temperatureAvg, e.temperature, n);
    stat.humidityAvg    = weightedAvg(prev?.humidityAvg,    e.humidity,    n);
  }

  return new SensorEventStat(stat);
}

function upsertBucket(
  events: SensorEventStat[],
  e: SensorEvent,
  bucketSize: number,
  counts: Record<number, number>,
  device: DeviceEvent,
): SensorEventStat[] {
  const bucketTime = Math.floor(e.time / bucketSize) * bucketSize;
  const last = events.at(-1);

  if (last && last.time === bucketTime) {
    const n = (counts[bucketTime] ?? 1) + 1;
    counts[bucketTime] = n;
    return [...events.slice(0, -1), buildBucketStat(bucketTime, e, last, n, device)];
  }

  if (!last || bucketTime > last.time) {
    counts[bucketTime] = 1;
    return [...events, buildBucketStat(bucketTime, e, null, 1, device)];
  }

  return events;
}

const xAxisConfig = {
  ticks: {
    maxTicksLimit: 12,
    maxRotation: 0,
  },
};

function fmtTime(unix: number): string {
  return new Date(unix * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

type Period = "24h" | "30d";
type Co2Chart = "co2" | "eco2" | "th";
type ChartMode = "sensor" | "online";

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateToTill(dateStr: string): number | undefined {
  if (dateStr === todayStr()) return undefined;
  const [y, mo, d] = dateStr.split("-").map(Number);
  return Math.floor(new Date(y, mo - 1, d + 1).getTime() / 1000);
}

function ButtonSelector<T extends string>({ options, labels, current, onChange }: { options: T[]; labels?: string[]; current: T; onChange: (v: T) => void }) {
  return (
    <div className="btn-group mb-3">
      {options.map((o, i) => (
        <button
          key={o}
          className={`btn btn-sm ${current === o ? "btn-primary" : "btn-outline-primary"}`}
          onClick={() => onChange(o)}
        >
          {labels?.[i] ?? o}
        </button>
      ))}
    </div>
  );
}

export function DevicePage({ api, devices, latestSensorEvent }: DevicePageProperties) {
  const { t } = useTranslation();
  const { idStr } = useParams();
  const deviceId = typeof idStr === "undefined" ? 0 : +idStr;

  let device = devices[deviceId];

  const [eventsMonthly, setEventsMonthly] = useState<SensorDailyEvent[] | undefined>(undefined);
  const [events5min, setEvents5min] = useState<SensorEventStat[] | undefined>(undefined);
  const [period, setPeriod] = useState<Period>("24h");
  const [co2Chart, setCo2Chart] = useState<Co2Chart>("co2");
  const [chartMode, setChartMode] = useState<ChartMode>("sensor");
  const [selectedDate, setSelectedDate] = useState<string>(todayStr());
  const counts5min = useRef<Record<number, number>>({});

  useEffect(() => {
    setEvents5min(undefined);
    setEventsMonthly(undefined);
    setPeriod("24h");
    setCo2Chart("co2");
    setChartMode("sensor");
    setSelectedDate(todayStr());
    counts5min.current = {};

    api.sensorsConfigurable(deviceId, "24h", "5m").then(setEvents5min);
  }, [deviceId]);

  useEffect(() => {
    if (!latestSensorEvent || latestSensorEvent.deviceId !== deviceId) return;
    if (selectedDate !== todayStr()) return;
    const e = latestSensorEvent;
    setEvents5min(prev => prev ? upsertBucket(prev, e, 300, counts5min.current, device) : prev);
  }, [latestSensorEvent]);


  function changePeriod(newPeriod: Period) {
    setPeriod(newPeriod);
    if (newPeriod === "30d") setChartMode("sensor");
    if (newPeriod === "30d" && eventsMonthly === undefined) {
      api.sensorsDaily(deviceId).then(setEventsMonthly);
    }
  }

  function handleDateChange(newDate: string) {
    setSelectedDate(newDate);
    setEvents5min(undefined);
    api.sensorsConfigurable(deviceId, "24h", "5m", dateToTill(newDate)).then(setEvents5min);
  }

  return (
    <>
      <div className="row">
        <h2 className="d-flex align-items-center gap-2">
          <PowerIcon device={device}/>
          {device.name}
          <DeviceConfigPanel api={api} device={device} />
        </h2>
      </div>

      { device.isEnergySensor() && (
        <>
          <div className="row">
            <div className="row font-monospace">
              <Col xs={4}>
                <h1>
                  <strong> {device.state.power} W </strong>
                </h1>
              </Col>
              <Col xs={4}>
                <h1>
                  <strong> {device.state.current} A </strong>
                </h1>
              </Col>
              <Col xs={4}>
                <h1>
                  <strong> {device.state.voltage} V </strong>
                </h1>
              </Col>
            </div>
          </div>

          <div className="row">
            <div className="d-flex gap-2 align-items-center">
              <ButtonSelector options={["24h", "30d"]} labels={[t("devicePage.period_24h"), t("devicePage.period_30d")]} current={period} onChange={changePeriod} />
              {period === "24h" && <input type="date" className="form-control form-control-sm w-auto mb-3" value={selectedDate} max={todayStr()} onChange={(e) => handleDateChange(e.target.value)} />}
              {period !== "30d" && <ButtonSelector options={["sensor", "online"] as ChartMode[]} labels={[t("devicePage.sensor"), t("devicePage.online")]} current={chartMode} onChange={setChartMode} />}
            </div>
            {period === "24h" && chartMode === "sensor" && (events5min === undefined    ? <ChartSpinner /> : <ChartPower events={events5min} />)}
            {period === "30d"                           && (eventsMonthly === undefined ? <ChartSpinner /> : <ChartDailyConsumption dailyEvents={eventsMonthly} />)}
            {period === "24h" && chartMode === "online" && (events5min === undefined    ? <ChartSpinner /> : <ChartOnline events={events5min} />)}
          </div>
        </>
      ) }

      { device.isCo2Sensor() && (
        <>
          <div className="row">
            <div className="row font-monospace">
              <Col xs={4}>
                <h1>
                  <strong> {device.state.temperature} °C </strong>
                </h1>
              </Col>
              <Col xs={4}>
                <h1>
                  <strong> {device.state.humidity} % </strong>
                </h1>
              </Col>
              <Col xs={4}>
                <h1>
                  <strong> {device.state.co2e} ppm </strong>
                </h1>
              </Col>
            </div>
          </div>

          <div className="row">
            <div className="d-flex gap-2 align-items-center">
              <ButtonSelector options={["24h"]} labels={[t("devicePage.period_24h")]} current={period} onChange={changePeriod} />
              {period === "24h" && <input type="date" className="form-control form-control-sm w-auto mb-3" value={selectedDate} max={todayStr()} onChange={(e) => handleDateChange(e.target.value)} />}
              {chartMode === "sensor" && <ButtonSelector options={["co2", "eco2", "th"]} labels={["CO₂", "eCO₂", "T&H"]} current={co2Chart} onChange={setCo2Chart} />}
              <ButtonSelector options={["sensor", "online"] as ChartMode[]} labels={[t("devicePage.sensor"), t("devicePage.online")]} current={chartMode} onChange={setChartMode} />
            </div>
            {period === "24h" && chartMode === "sensor" && co2Chart === "co2"  && (events5min === undefined ? <ChartSpinner /> : <ChartCo2  events={events5min} />)}
            {period === "24h" && chartMode === "sensor" && co2Chart === "eco2" && (events5min === undefined ? <ChartSpinner /> : <ChartEco2 events={events5min} />)}
            {period === "24h" && chartMode === "sensor" && co2Chart === "th"   && (events5min === undefined ? <ChartSpinner /> : <ChartTH   events={events5min} />)}
            {period === "24h" && chartMode === "online"                        && (events5min === undefined ? <ChartSpinner /> : <ChartOnline events={events5min} />)}
          </div>
        </>
      ) }

      { device.isThSensor() && (
        <>
          <div className="row">
            <div className="row font-monospace">
              <Col xs={4}>
                <h1>
                  <strong> {device.state.temperature} °C </strong>
                </h1>
              </Col>
              <Col xs={4}>
                <h1>
                  <strong> {device.state.humidity} % </strong>
                </h1>
              </Col>
            </div>
          </div>

          <div className="row">
            <div className="d-flex gap-2 align-items-center">
              <ButtonSelector options={["24h"]} labels={[t("devicePage.period_24h")]} current={period} onChange={changePeriod} />
              {period === "24h" && <input type="date" className="form-control form-control-sm w-auto mb-3" value={selectedDate} max={todayStr()} onChange={(e) => handleDateChange(e.target.value)} />}
              <ButtonSelector options={["sensor", "online"] as ChartMode[]} labels={[t("devicePage.sensor"), t("devicePage.online")]} current={chartMode} onChange={setChartMode} />
            </div>
            {period === "24h" && chartMode === "sensor" && (events5min === undefined ? <ChartSpinner /> : <ChartTH events={events5min} />)}
            {period === "24h" && chartMode === "online" && (events5min === undefined ? <ChartSpinner /> : <ChartOnline events={events5min} />)}
          </div>
        </>
      ) }
    </>
  );
}

function ChartSpinner() {
  return (
    <div className="text-center py-5">
      <div className="spinner-border" role="status">
        <span className="visually-hidden">Loading...</span>
      </div>
    </div>
  );
}

type DailyChartProperties = {
  dailyEvents: SensorDailyEvent[];
};

function ChartDailyConsumption({ dailyEvents }: DailyChartProperties) {
  const data = {
    labels: dailyEvents.map((e) => e.date),
    datasets: [
      {
        label: "kWh",
        borderColor: CHART_COLORS.powerConsumed.border,
        backgroundColor: CHART_COLORS.powerConsumed.background,
        data: dailyEvents.map((e) => e.power != null ? +e.power.toFixed(3) : null),
      },
    ],
  };
  const options = {
    responsive: true,
    animation: { duration: 0 },
    plugins: {
      tooltip: { mode: "index" as InteractionMode, intersect: false },
    },
    scales: {
      x: xAxisConfig,
      y: {
        min: 0,
        title: { display: true, text: "kWh" },
      },
    },
  };

  return <Bar data={data} options={options} />;
}

function ChartPower({ events }: { events: SensorEventStat[] }) {
  const data = {
    labels: events.map((r) => fmtTime(r.time)),
    datasets: [
      {
        label: "W",
        borderColor: CHART_COLORS.power.border,
        backgroundColor: CHART_COLORS.power.background,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        yAxisID: "y",
        data: events.map((r) => r.powerAvg),
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
      x: xAxisConfig,
      y: {
        type: "linear" as const,
        position: "left" as const,
        min: 0,
        title: { display: true, text: "W" },
      },
    },
  };

  return <Line data={data} options={options} />;
}

function ChartCo2({ events }: { events: SensorEventStat[] }) {
  const data = {
    labels: events.map((r) => fmtTime(r.time)),
    datasets: [
      {
        label: "CO₂ ppm",
        borderColor: CHART_COLORS.co2.border,
        backgroundColor: CHART_COLORS.co2.background,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        data: events.map((r) => r.co2Avg),
      },
    ],
  };
  const options = {
    responsive: true,
    animation: { duration: 0 },
    plugins: {
      tooltip: { mode: "index" as InteractionMode, intersect: false },
    },
    scales: {
      x: xAxisConfig,
      y: {
        min: 400,
        title: { display: true, text: "ppm" },
      },
    },
  };

  return <Line data={data} options={options} />;
}

function ChartEco2({ events }: { events: SensorEventStat[] }) {
  const data = {
    labels: events.map((r) => fmtTime(r.time)),
    datasets: [
      {
        label: "eCO₂ ppm",
        borderColor: CHART_COLORS.eco2.border,
        backgroundColor: CHART_COLORS.eco2.background,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        data: events.map((r) => r.co2eAvg),
      },
    ],
  };
  const options = {
    responsive: true,
    animation: { duration: 0 },
    plugins: {
      tooltip: { mode: "index" as InteractionMode, intersect: false },
    },
    scales: {
      x: xAxisConfig,
      y: {
        min: 400,
        title: { display: true, text: "ppm" },
      },
    },
  };

  return <Line data={data} options={options} />;
}

function ChartOnline({ events }: { events: SensorEventStat[] }) {
  const data = {
    labels: events.map((r) => fmtTime(r.time)),
    datasets: [
      {
        label: "Online",
        borderColor: CHART_COLORS.online.border,
        backgroundColor: CHART_COLORS.online.background,
        fill: true,
        stepped: true,
        pointRadius: 0,
        data: events.map((r) =>
          r.powerAvg != null || r.co2eAvg != null || r.temperatureAvg != null ? 1 : 0
        ),
      },
    ],
  };
  const options = {
    responsive: true,
    animation: { duration: 0 },
    plugins: {
      tooltip: { mode: "index" as InteractionMode, intersect: false },
    },
    scales: {
      x: xAxisConfig,
      y: {
        min: 0,
        max: 1,
        ticks: {
          stepSize: 1,
          callback: (v: string | number) => (v === 1 ? "online" : "offline"),
        },
      },
    },
  };
  return <Line data={data} options={options} />;
}

function ChartTH({ events }: { events: SensorEventStat[] }) {
  const data = {
    labels: events.map((r) => fmtTime(r.time)),
    datasets: [
      {
        label: "°C",
        borderColor: CHART_COLORS.temperature.border,
        backgroundColor: CHART_COLORS.temperature.background,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        yAxisID: "y",
        data: events.map((r) => r.temperatureAvg),
      },
      {
        label: "H₂O %",
        borderColor: CHART_COLORS.humidity.border,
        backgroundColor: CHART_COLORS.humidity.background,
        fill: false,
        tension: 0.3,
        pointRadius: 0,
        yAxisID: "y1",
        data: events.map((r) => r.humidityAvg),
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
      x: xAxisConfig,
      y: {
        type: "linear" as const,
        position: "left" as const,
        title: { display: true, text: "°C" },
      },
      y1: {
        type: "linear" as const,
        position: "right" as const,
        min: 0,
        max: 100,
        title: { display: true, text: "%" },
        grid: { drawOnChartArea: false },
      },
    },
  };

  return <Line data={data} options={options} />;
}
