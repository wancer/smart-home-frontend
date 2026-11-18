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
import IrPanel from "../element/ir-panel.tsx";
import ChipTemperature from "../element/chip-temperature.tsx";

type DevicePageProperties = {
  api: HttpApi;
  devices: DeviceEvent[];
  latestSensorEvent: SensorEvent | null;
};

function weightedAvg(prev: number | null | undefined, next: number, n: number): number {
  if (n === 1 || prev == null) return next;
  return (prev * (n - 1) + next) / n;
}

function bucketMin(prev: number | null | undefined, next: number, n: number): number {
  return n === 1 || prev == null ? next : Math.min(prev, next);
}

function bucketMax(prev: number | null | undefined, next: number, n: number): number {
  return n === 1 || prev == null ? next : Math.max(prev, next);
}

function buildBucketStat(bucketTime: number, e: SensorEvent, prev: SensorEventStat | null, n: number, device: DeviceEvent): SensorEventStat {
  const stat: any = {
    time: bucketTime,
    powerConsumed: prev?.powerConsumed ?? null,
    powerAvg: null,
    currentAvg: null,
    voltageAvg: null,
    co2Avg: null,
    temperatureAvg: null,
    humidityAvg: null,
  };

  if (device.isEnergySensor()) {
    stat.powerAvg   = weightedAvg(prev?.powerAvg,   e.power,   n);
    stat.powerMin   = bucketMin(prev?.powerMin,     e.power,   n);
    stat.powerMax   = bucketMax(prev?.powerMax,     e.power,   n);
    stat.currentAvg = weightedAvg(prev?.currentAvg, e.current, n);
    stat.voltageAvg = weightedAvg(prev?.voltageAvg, e.voltage, n);
  }

  if (device.isCo2Sensor()) {
    stat.co2Avg = weightedAvg(prev?.co2Avg, e.co2, n);
    stat.co2Min = bucketMin(prev?.co2Min,   e.co2, n);
    stat.co2Max = bucketMax(prev?.co2Max,   e.co2, n);
  }

  if (device.isCo2Sensor() || device.isThSensor()) {
    stat.temperatureAvg = weightedAvg(prev?.temperatureAvg, e.temperature, n);
    stat.temperatureMin = bucketMin(prev?.temperatureMin,   e.temperature, n);
    stat.temperatureMax = bucketMax(prev?.temperatureMax,   e.temperature, n);
    stat.humidityAvg    = weightedAvg(prev?.humidityAvg,    e.humidity,    n);
    stat.humidityMin    = bucketMin(prev?.humidityMin,      e.humidity,    n);
    stat.humidityMax    = bucketMax(prev?.humidityMax,      e.humidity,    n);
  }

  return new SensorEventStat(stat);
}

// upsertBucket adds a live reading to the chart: into the last point if it's in the same
// bucket, otherwise as a new point (bucketSize 0 = raw: every reading is a point). Points
// older than windowSeconds are dropped, so the chart slides with time.
function upsertBucket(
  events: SensorEventStat[],
  e: SensorEvent,
  bucketSize: number,
  windowSeconds: number,
  counts: Record<number, number>,
  device: DeviceEvent,
): SensorEventStat[] {
  const bucketTime = bucketSize === 0 ? e.time : Math.floor(e.time / bucketSize) * bucketSize;
  const last = events.at(-1);

  if (last && last.time === bucketTime) {
    const n = (counts[bucketTime] ?? 1) + 1;
    counts[bucketTime] = n;
    return [...events.slice(0, -1), buildBucketStat(bucketTime, e, last, n, device)];
  }

  if (!last || bucketTime > last.time) {
    counts[bucketTime] = 1;
    const kept = events.filter(r => r.time > bucketTime - windowSeconds);
    return [...kept, buildBucketStat(bucketTime, e, null, 1, device)];
  }

  return events;
}

// chartStep is the step between points. The backend raises the requested one when the
// device stores coarser buckets for that range, so it's read from the data.
function chartStep(events: SensorEventStat[], requested: number): number {
  if (requested === 0) return 0; // raw
  return events.length > 1 ? events[1].time - events[0].time : requested;
}

// withGaps marks outages in raw data, which has no empty steps: an empty point is inserted
// where readings are more than 3× the usual interval apart, so lines break there and the
// online chart drops to offline.
function withGaps(events: SensorEventStat[]): SensorEventStat[] {
  if (events.length < 3) return events;
  const intervals = events.slice(1).map((r, i) => r.time - events[i].time).sort((a, b) => a - b);
  const limit = 3 * Math.max(1, intervals[Math.floor(intervals.length / 2)]);
  const result: SensorEventStat[] = [events[0]];
  for (let i = 1; i < events.length; i++) {
    if (events[i].time - events[i - 1].time > limit) {
      result.push(new SensorEventStat({ time: events[i - 1].time + limit }));
    }
    result.push(events[i]);
  }
  return result;
}

// chartLabels shows seconds only for raw readings, which aren't on whole minutes.
function chartLabels(events: SensorEventStat[]): string[] {
  const seconds = events.some(r => r.time % 60 !== 0);
  return events.map(r => new Date(r.time * 1000).toLocaleTimeString([], seconds
    ? { hour: "2-digit", minute: "2-digit", second: "2-digit" }
    : { hour: "2-digit", minute: "2-digit" }));
}

type ChartColor = { border: string; background: string };

// bandDatasets draws the min-max range as a filled band (max fills down to min). They must
// come right after each other; legend items for them are hidden by hideBandLegend.
function bandDatasets(label: string, color: ChartColor, min: (number | null)[], max: (number | null)[], yAxisID = "y") {
  const common = {
    borderColor: "transparent",
    backgroundColor: color.background,
    pointRadius: 0,
    tension: 0.3,
    yAxisID,
  };
  return [
    { ...common, label: `${label} max`, data: max, fill: "+1" as const },
    { ...common, label: `${label} min`, data: min, fill: false },
  ];
}

const hideBandLegend = {
  labels: {
    filter: (item: { text: string }) => !item.text.endsWith(" max") && !item.text.endsWith(" min"),
  },
};

const xAxisConfig = {
  ticks: {
    maxTicksLimit: 12,
    maxRotation: 0,
  },
};

type Period = "1h" | "24h" | "30d";
type LivePeriod = Exclude<Period, "30d">;

// What the 1h/24h charts request: [duration, step, step seconds (0 = raw), window seconds].
// 1h shows every reading for devices that store raw data, 1-minute steps otherwise.
function chartRange(p: LivePeriod, device: DeviceEvent): [string, string, number, number] {
  if (p === "1h") return device.storesRaw() ? ["1h", "raw", 0, 3600] : ["1h", "1m", 60, 3600];
  return ["24h", "5m", 300, 86400];
}
type Co2Chart = "co2" | "th";
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
  const [events, setEvents] = useState<SensorEventStat[] | undefined>(undefined);
  const [period, setPeriod] = useState<Period>("24h");
  const [co2Chart, setCo2Chart] = useState<Co2Chart>("co2");
  const [chartMode, setChartMode] = useState<ChartMode>("sensor");
  const [selectedDate, setSelectedDate] = useState<string>(todayStr());
  const [chipChartOpen, setChipChartOpen] = useState(false);
  const counts = useRef<Record<number, number>>({});
  const chartEvents = events !== undefined && period === "1h" && device.storesRaw() ? withGaps(events) : events;
  const loadId = useRef(0);

  // loadEvents fetches the 1h/24h chart; a slower earlier request can't overwrite it.
  function loadEvents(p: LivePeriod, date: string) {
    const id = ++loadId.current;
    setEvents(undefined);
    counts.current = {};
    const [duration, scale] = chartRange(p, device);
    const till = p === "24h" ? dateToTill(date) : undefined;
    api.sensorsConfigurable(deviceId, duration, scale, till).then(loaded => {
      if (id === loadId.current) setEvents(loaded);
    });
  }

  useEffect(() => {
    setEventsMonthly(undefined);
    setPeriod("24h");
    setCo2Chart("co2");
    setChartMode("sensor");
    setSelectedDate(todayStr());
    setChipChartOpen(false);

    if (device.isIrRemote()) {
      setEvents(undefined);
    } else {
      loadEvents("24h", todayStr());
    }
  }, [deviceId]);

  useEffect(() => {
    if (!latestSensorEvent || latestSensorEvent.deviceId !== deviceId) return;
    if (period === "30d" || (period === "24h" && selectedDate !== todayStr())) return;
    const e = latestSensorEvent;
    const [, , requestedStep, windowSeconds] = chartRange(period, device);
    setEvents(prev => prev ? upsertBucket(prev, e, chartStep(prev, requestedStep), windowSeconds, counts.current, device) : prev);
  }, [latestSensorEvent]);


  function changePeriod(newPeriod: Period) {
    if (newPeriod === period) return;
    setPeriod(newPeriod);
    if (newPeriod === "30d") {
      setChartMode("sensor");
      if (eventsMonthly === undefined) api.sensorsDaily(deviceId).then(setEventsMonthly);
    } else {
      loadEvents(newPeriod, selectedDate);
    }
  }

  function handleDateChange(newDate: string) {
    setSelectedDate(newDate);
    loadEvents("24h", newDate);
  }

  return (
    <>
      <div className="row">
        <h2 className="d-flex align-items-center gap-2">
          <PowerIcon device={device}/>
          {device.name}
          <DeviceConfigPanel
            api={api}
            device={device}
            chipChartOpen={chipChartOpen}
            onToggleChipChart={() => setChipChartOpen(o => !o)}
          />
        </h2>
      </div>

      { device.storeChipTemp && chipChartOpen && <ChipTemperature key={"chip-" + device.id} api={api} device={device} latestSensorEvent={latestSensorEvent} /> }

      { device.isIrRemote() && <IrPanel key={"ir-" + device.id} api={api} device={device} devices={devices} /> }

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
              <ButtonSelector options={["1h", "24h", "30d"] as Period[]} labels={[t("devicePage.period_1h"), t("devicePage.period_24h"), t("devicePage.period_30d")]} current={period} onChange={changePeriod} />
              {period === "24h" && <input type="date" className="form-control form-control-sm w-auto mb-3" value={selectedDate} max={todayStr()} onChange={(e) => handleDateChange(e.target.value)} />}
              {period !== "30d" && <ButtonSelector options={["sensor", "online"] as ChartMode[]} labels={[t("devicePage.sensor"), t("devicePage.online")]} current={chartMode} onChange={setChartMode} />}
            </div>
            {period !== "30d" && chartMode === "sensor" && (chartEvents === undefined ? <ChartSpinner /> : <ChartPower events={chartEvents} />)}
            {period === "30d"                           && (eventsMonthly === undefined ? <ChartSpinner /> : <ChartDailyConsumption dailyEvents={eventsMonthly} />)}
            {period !== "30d" && chartMode === "online" && (chartEvents === undefined ? <ChartSpinner /> : <ChartOnline events={chartEvents} />)}
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
                  <strong> {device.state.co2} ppm </strong>
                </h1>
              </Col>
            </div>
          </div>

          <div className="row">
            <div className="d-flex gap-2 align-items-center">
              <ButtonSelector options={["1h", "24h"] as Period[]} labels={[t("devicePage.period_1h"), t("devicePage.period_24h")]} current={period} onChange={changePeriod} />
              {period === "24h" && <input type="date" className="form-control form-control-sm w-auto mb-3" value={selectedDate} max={todayStr()} onChange={(e) => handleDateChange(e.target.value)} />}
              {chartMode === "sensor" && <ButtonSelector options={["co2", "th"]} labels={["CO₂", "T&H"]} current={co2Chart} onChange={setCo2Chart} />}
              <ButtonSelector options={["sensor", "online"] as ChartMode[]} labels={[t("devicePage.sensor"), t("devicePage.online")]} current={chartMode} onChange={setChartMode} />
            </div>
            {period !== "30d" && chartMode === "sensor" && co2Chart === "co2"  && (chartEvents === undefined ? <ChartSpinner /> : <ChartCo2  events={chartEvents} />)}
            {period !== "30d" && chartMode === "sensor" && co2Chart === "th"   && (chartEvents === undefined ? <ChartSpinner /> : <ChartTH   events={chartEvents} />)}
            {period !== "30d" && chartMode === "online"                        && (chartEvents === undefined ? <ChartSpinner /> : <ChartOnline events={chartEvents} />)}
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
              <ButtonSelector options={["1h", "24h"] as Period[]} labels={[t("devicePage.period_1h"), t("devicePage.period_24h")]} current={period} onChange={changePeriod} />
              {period === "24h" && <input type="date" className="form-control form-control-sm w-auto mb-3" value={selectedDate} max={todayStr()} onChange={(e) => handleDateChange(e.target.value)} />}
              <ButtonSelector options={["sensor", "online"] as ChartMode[]} labels={[t("devicePage.sensor"), t("devicePage.online")]} current={chartMode} onChange={setChartMode} />
            </div>
            {period !== "30d" && chartMode === "sensor" && (chartEvents === undefined ? <ChartSpinner /> : <ChartTH events={chartEvents} />)}
            {period !== "30d" && chartMode === "online" && (chartEvents === undefined ? <ChartSpinner /> : <ChartOnline events={chartEvents} />)}
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
    labels: chartLabels(events),
    datasets: [
      {
        label: "W",
        borderColor: CHART_COLORS.power.border,
        backgroundColor: CHART_COLORS.power.background,
        fill: false,
        tension: 0.3,
        pointRadius: 0,
        yAxisID: "y",
        data: events.map((r) => r.powerAvg),
      },
      ...bandDatasets("W", CHART_COLORS.power, events.map((r) => r.powerMin), events.map((r) => r.powerMax)),
    ],
  };
  const options = {
    responsive: true,
    animation: { duration: 0 },
    interaction: { mode: "index" as InteractionMode, intersect: false },
    plugins: {
      legend: hideBandLegend,
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
    labels: chartLabels(events),
    datasets: [
      {
        label: "CO₂ ppm",
        borderColor: CHART_COLORS.co2.border,
        backgroundColor: CHART_COLORS.co2.background,
        fill: false,
        tension: 0.3,
        pointRadius: 0,
        data: events.map((r) => r.co2Avg),
      },
      ...bandDatasets("CO₂ ppm", CHART_COLORS.co2, events.map((r) => r.co2Min), events.map((r) => r.co2Max)),
    ],
  };
  const options = {
    responsive: true,
    animation: { duration: 0 },
    interaction: { mode: "index" as InteractionMode, intersect: false },
    plugins: {
      legend: hideBandLegend,
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
    labels: chartLabels(events),
    datasets: [
      {
        label: "Online",
        borderColor: CHART_COLORS.online.border,
        backgroundColor: CHART_COLORS.online.background,
        fill: true,
        stepped: true,
        pointRadius: 0,
        data: events.map((r) =>
          r.powerAvg != null || r.co2Avg != null || r.temperatureAvg != null ? 1 : 0
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
    labels: chartLabels(events),
    datasets: [
      {
        label: "°C",
        borderColor: CHART_COLORS.temperature.border,
        backgroundColor: CHART_COLORS.temperature.background,
        fill: false,
        tension: 0.3,
        pointRadius: 0,
        yAxisID: "y",
        data: events.map((r) => r.temperatureAvg),
      },
      ...bandDatasets("°C", CHART_COLORS.temperature, events.map((r) => r.temperatureMin), events.map((r) => r.temperatureMax)),
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
      ...bandDatasets("H₂O %", CHART_COLORS.humidity, events.map((r) => r.humidityMin), events.map((r) => r.humidityMax), "y1"),
    ],
  };
  const options = {
    responsive: true,
    animation: { duration: 0 },
    interaction: { mode: "index" as InteractionMode, intersect: false },
    plugins: {
      legend: hideBandLegend,
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
