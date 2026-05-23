"use client";

import { useEffect, useState } from "react";
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
import HttpApi from "../api/http.ts";
import SensorDailyEvent from "../api/types/sensor-daily.ts";
import SensorEventStat from "../api/types/sensor-event-stat.ts";
import PowerIcon from "../element/power-icon.tsx";

type DevicePageProperties = {
  api: HttpApi;
  devices: DeviceEvent[];
};

const xAxisConfig = {
  ticks: {
    maxTicksLimit: 12,
    maxRotation: 0,
  },
};

function fmtTime(unix: number): string {
  return new Date(unix * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

type Period = "1h" | "24h" | "30d";
type Co2Chart = "co2" | "th";
type ChartMode = "sensor" | "online";

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

export function DevicePage({ api, devices }: DevicePageProperties) {
  const { t } = useTranslation();
  const { idStr } = useParams();
  const deviceId = typeof idStr === "undefined" ? 0 : +idStr;

  let device = devices[deviceId];

  const [eventsMonthly, setEventsMonthly] = useState<SensorDailyEvent[] | undefined>(undefined);
  const [events5min, setEvents5min] = useState<SensorEventStat[] | undefined>(undefined);
  const [events1min, setEvents1min] = useState<SensorEventStat[] | undefined>(undefined);
  const [period, setPeriod] = useState<Period>("24h");
  const [co2Chart, setCo2Chart] = useState<Co2Chart>("co2");
  const [chartMode, setChartMode] = useState<ChartMode>("sensor");

  useEffect(() => {
    setEvents5min(undefined);
    setEvents1min(undefined);
    setEventsMonthly(undefined);
    setPeriod("24h");
    setCo2Chart("co2");
    setChartMode("sensor");

    api.sensorsConfigurable(deviceId, "24h", "5m").then(setEvents5min);
  }, [deviceId]);

  function changePeriod(newPeriod: Period) {
    setPeriod(newPeriod);
    if (newPeriod === "30d") setChartMode("sensor");
    if (newPeriod === "1h" && events1min === undefined) {
      api.sensorsConfigurable(deviceId, "1h", "1m").then(setEvents1min);
    }
    if (newPeriod === "30d" && eventsMonthly === undefined) {
      api.sensorsDaily(deviceId).then(setEventsMonthly);
    }
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
            <div className="d-flex gap-2">
              <ButtonSelector options={["1h", "24h", "30d"]} labels={[t("devicePage.period_1h"), t("devicePage.period_24h"), t("devicePage.period_30d")]} current={period} onChange={changePeriod} />
              {period !== "30d" && <ButtonSelector options={["sensor", "online"] as ChartMode[]} labels={[t("devicePage.sensor"), t("devicePage.online")]} current={chartMode} onChange={setChartMode} />}
            </div>
            {period === "1h"  && chartMode === "sensor" && (events1min === undefined    ? <ChartSpinner /> : <ChartPower events={events1min} />)}
            {period === "24h" && chartMode === "sensor" && (events5min === undefined    ? <ChartSpinner /> : <ChartPower events={events5min} />)}
            {period === "30d"                           && (eventsMonthly === undefined ? <ChartSpinner /> : <ChartDailyConsumption dailyEvents={eventsMonthly} />)}
            {period === "1h"  && chartMode === "online" && (events1min === undefined    ? <ChartSpinner /> : <ChartOnline events={events1min} />)}
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
            <div className="d-flex gap-2">
              <ButtonSelector options={["1h", "24h"]} labels={[t("devicePage.period_1h"), t("devicePage.period_24h")]} current={period} onChange={changePeriod} />
              {chartMode === "sensor" && <ButtonSelector options={["co2", "th"]} labels={["CO₂", "T&H"]} current={co2Chart} onChange={setCo2Chart} />}
              <ButtonSelector options={["sensor", "online"] as ChartMode[]} labels={[t("devicePage.sensor"), t("devicePage.online")]} current={chartMode} onChange={setChartMode} />
            </div>
            {period === "1h"  && chartMode === "sensor" && co2Chart === "co2" && (events1min === undefined ? <ChartSpinner /> : <ChartCo2 events={events1min} />)}
            {period === "1h"  && chartMode === "sensor" && co2Chart === "th"  && (events1min === undefined ? <ChartSpinner /> : <ChartTH  events={events1min} />)}
            {period === "24h" && chartMode === "sensor" && co2Chart === "co2" && (events5min === undefined ? <ChartSpinner /> : <ChartCo2 events={events5min} />)}
            {period === "24h" && chartMode === "sensor" && co2Chart === "th"  && (events5min === undefined ? <ChartSpinner /> : <ChartTH  events={events5min} />)}
            {period === "1h"  && chartMode === "online"                        && (events1min === undefined ? <ChartSpinner /> : <ChartOnline events={events1min} />)}
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
            <div className="d-flex gap-2">
              <ButtonSelector options={["1h", "24h"]} labels={[t("devicePage.period_1h"), t("devicePage.period_24h")]} current={period} onChange={changePeriod} />
              <ButtonSelector options={["sensor", "online"] as ChartMode[]} labels={[t("devicePage.sensor"), t("devicePage.online")]} current={chartMode} onChange={setChartMode} />
            </div>
            {period === "1h"  && chartMode === "sensor" && (events1min === undefined ? <ChartSpinner /> : <ChartTH events={events1min} />)}
            {period === "24h" && chartMode === "sensor" && (events5min === undefined ? <ChartSpinner /> : <ChartTH events={events5min} />)}
            {period === "1h"  && chartMode === "online" && (events1min === undefined ? <ChartSpinner /> : <ChartOnline events={events1min} />)}
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
        label: "W·h",
        borderColor: "#7c3aed",
        backgroundColor: "rgba(124,58,237,0.7)",
        data: dailyEvents.map((e) => e.power),
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
        title: { display: true, text: "W·h" },
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
        borderColor: "#ef4444",
        backgroundColor: "rgba(239,68,68,0.15)",
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
        label: "eCO₂ ppm",
        borderColor: "#10b981",
        backgroundColor: "rgba(16,185,129,0.15)",
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
        borderColor: "#22c55e",
        backgroundColor: "rgba(34,197,94,0.25)",
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
        borderColor: "#f97316",
        backgroundColor: "rgba(249,115,22,0.15)",
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        yAxisID: "y",
        data: events.map((r) => r.temperatureAvg),
      },
      {
        label: "H₂O %",
        borderColor: "#06b6d4",
        backgroundColor: "rgba(6,182,212,0.1)",
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
