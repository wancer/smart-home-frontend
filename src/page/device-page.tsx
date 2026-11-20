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
import { CHART_COLORS, ChartColor } from "../chart-colors.ts";
import HttpApi from "../api/http.ts";
import SensorDailyEvent from "../api/types/sensor-daily.ts";
import SensorEventStat, { StatKind } from "../api/types/sensor-event-stat.ts";
import { CHART_GROUPS, formatMetric, Metric, METRIC_BY_KEY, MetricKey, METRICS, reportedMetrics } from "../metrics.ts";
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

// buildBucketStat folds a live reading into its bucket. Every metric the reading carries is
// averaged; one it lacks keeps the bucket's earlier values.
function buildBucketStat(bucketTime: number, e: SensorEvent, prev: SensorEventStat | null, n: number): SensorEventStat {
  const stat: Record<string, number | null> = {
    time: bucketTime,
    powerConsumed: prev?.powerConsumed ?? null,
  };

  for (const m of METRICS) {
    const v = e[m.key];
    const pAvg = prev?.get(m.key, "Avg") ?? null;
    const pMin = prev?.get(m.key, "Min") ?? null;
    const pMax = prev?.get(m.key, "Max") ?? null;
    if (v == null) {
      stat[m.key + "Avg"] = pAvg;
      stat[m.key + "Min"] = pMin;
      stat[m.key + "Max"] = pMax;
      continue;
    }
    stat[m.key + "Avg"] = weightedAvg(pAvg, v, n);
    stat[m.key + "Min"] = bucketMin(pMin, v, n);
    stat[m.key + "Max"] = bucketMax(pMax, v, n);
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
): SensorEventStat[] {
  const bucketTime = bucketSize === 0 ? e.time : Math.floor(e.time / bucketSize) * bucketSize;
  const last = events.at(-1);

  if (last && last.time === bucketTime) {
    const n = (counts[bucketTime] ?? 1) + 1;
    counts[bucketTime] = n;
    return [...events.slice(0, -1), buildBucketStat(bucketTime, e, last, n)];
  }

  if (!last || bucketTime > last.time) {
    counts[bucketTime] = 1;
    const kept = events.filter(r => r.time > bucketTime - windowSeconds);
    return [...kept, buildBucketStat(bucketTime, e, null, 1)];
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
  const [chartGroupId, setChartGroupId] = useState<string | null>(null);
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
    setChartGroupId(null);
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
    setEvents(prev => prev ? upsertBucket(prev, e, chartStep(prev, requestedStep), windowSeconds, counts.current) : prev);
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

  // Chart tabs for what the device reports (now or in the loaded range), not what its type implies.
  const chartGroups = CHART_GROUPS.filter(g => g.metrics.some(k =>
    device.state[k] != null || chartEvents?.some(r => r.get(k, "Avg") != null)));
  const chartGroup = chartGroups.find(g => g.id === chartGroupId) ?? chartGroups[0];
  // daily consumption exists for AC energy only
  const hasAcEnergy = device.isEnergySensor() || device.state.power != null;
  const periods: Period[] = hasAcEnergy ? ["1h", "24h", "30d"] : ["1h", "24h"];

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

      { !device.isIrRemote() && (
        <>
          <MetricTiles device={device} />

          <div className="row">
            <div className="d-flex flex-wrap gap-2 align-items-center">
              <ButtonSelector options={periods} labels={periods.map(p => t("devicePage.period_" + p))} current={period} onChange={changePeriod} />
              {period === "24h" && <input type="date" className="form-control form-control-sm w-auto mb-3" value={selectedDate} max={todayStr()} onChange={(e) => handleDateChange(e.target.value)} />}
              {period !== "30d" && chartMode === "sensor" && chartGroups.length > 1 && chartGroup && (
                <ButtonSelector options={chartGroups.map(g => g.id)} labels={chartGroups.map(g => t(g.labelKey))} current={chartGroup.id} onChange={setChartGroupId} />
              )}
              {period !== "30d" && <ButtonSelector options={["sensor", "online"] as ChartMode[]} labels={[t("devicePage.sensor"), t("devicePage.online")]} current={chartMode} onChange={setChartMode} />}
            </div>
            {period !== "30d" && chartMode === "sensor" && (chartEvents === undefined ? <ChartSpinner /> : <ChartMetrics events={chartEvents} metrics={chartGroup?.metrics ?? []} />)}
            {period === "30d"                           && (eventsMonthly === undefined ? <ChartSpinner /> : <ChartDailyConsumption dailyEvents={eventsMonthly} />)}
            {period !== "30d" && chartMode === "online" && (chartEvents === undefined ? <ChartSpinner /> : <ChartOnline events={chartEvents} />)}
          </div>
        </>
      ) }
    </>
  );
}

// MetricTiles shows every value the device currently reports, whatever its sensor type.
function MetricTiles({ device }: { device: DeviceEvent }) {
  const values = reportedMetrics(device.state);
  if (values.length === 0) return null;
  return (
    <div className="row">
      <div className="row font-monospace">
        {values.map(m => (
          <Col xs={4} key={m.key}>
            <h1>
              <strong> {formatMetric(m, device.state[m.key] as number)} {m.unit} </strong>
              {m.tag && <small className="text-muted fs-5">{m.tag}</small>}
            </h1>
          </Col>
        ))}
      </div>
    </div>
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
        data: events.map((r) => METRICS.some(m => r.get(m.key, "Avg") != null) ? 1 : 0),
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

// ChartMetrics draws one or two metrics (left / right axis), each as its average with a
// min-max band. A metric with no reading in the whole range is left out.
function ChartMetrics({ events, metrics }: { events: SensorEventStat[]; metrics: MetricKey[] }) {
  const { t } = useTranslation();
  const shown = metrics.map(k => METRIC_BY_KEY[k]).filter(m => events.some(r => r.get(m.key, "Avg") != null));
  if (shown.length === 0) {
    return <div className="text-center text-muted py-5">{t("devicePage.noData")}</div>;
  }

  const round = (m: Metric, v: number | null) => v == null || m.precision === undefined ? v : +v.toFixed(m.precision);
  const series = (m: Metric, kind: StatKind) => events.map(r => round(m, r.get(m.key, kind)));
  const axisIds = ["y", "y1"];

  const datasets = shown.flatMap((m, i) => {
    const min = series(m, "Min");
    const max = series(m, "Max");
    const hasBand = min.some(v => v != null) && max.some(v => v != null);
    return [
      {
        label: m.chartLabel,
        borderColor: m.color.border,
        backgroundColor: m.color.background,
        fill: false,
        tension: 0.3,
        pointRadius: 0,
        yAxisID: axisIds[i],
        data: series(m, "Avg"),
      },
      ...(hasBand ? bandDatasets(m.chartLabel, m.color, min, max, axisIds[i]) : []),
    ];
  });

  const scales: Record<string, object> = { x: xAxisConfig };
  shown.forEach((m, i) => {
    scales[axisIds[i]] = {
      type: "linear" as const,
      position: i === 0 ? "left" as const : "right" as const,
      min: m.axisMin,
      max: m.axisMax,
      title: { display: true, text: m.tag ? `${m.unit} ${m.tag}` : m.unit },
      ...(i > 0 ? { grid: { drawOnChartArea: false } } : {}),
    };
  });

  const options = {
    responsive: true,
    animation: { duration: 0 },
    interaction: { mode: "index" as InteractionMode, intersect: false },
    plugins: {
      legend: hideBandLegend,
      tooltip: { mode: "index" as InteractionMode, intersect: false },
    },
    scales,
  };

  return <Line data={{ labels: chartLabels(events), datasets }} options={options} />;
}
