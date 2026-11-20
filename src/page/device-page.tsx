import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { Button, ButtonGroup, Col } from "react-bootstrap";
import DeviceConfigPanel from "../element/device-config-panel.tsx";
import { Line } from "react-chartjs-2";

import DeviceEvent from "../api/types/device.ts";
import { CHART_COLORS, ChartColor, indexTooltip, lineChartBase, timeAxis } from "../chart-setup.ts";
import HttpApi from "../api/http.ts";
import SensorEventStat, { StatKind } from "../api/types/sensor-event-stat.ts";
import { CHART_GROUPS, formatMetric, Metric, METRIC_BY_KEY, MetricKey, METRICS, reportedMetrics } from "../metrics.ts";
import { SensorEvent } from "../api/types/ws-event.ts";
import PowerIcon from "../element/power-icon.tsx";
import IrPanel from "../element/ir-panel.tsx";
import ChipTemperature from "../element/chip-temperature.tsx";
import { formatDuration } from "../format.ts";
import { ChartPeriod, chartLabels, chartPeriods, defaultPeriodIndex, pageEnd, pageLabel } from "../chart-periods.ts";

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

export function DevicePage({ api, devices, latestSensorEvent }: DevicePageProperties) {
  const { t } = useTranslation();
  const { idStr } = useParams();
  const deviceId = typeof idStr === "undefined" ? 0 : +idStr;

  let device = devices[deviceId];

  const periods = chartPeriods(device);
  const [periodIndex, setPeriodIndex] = useState(() => defaultPeriodIndex(periods));
  const period = periods[Math.min(periodIndex, periods.length - 1)];
  // offset counts pages back from now: 0 is the live page, 1 the previous whole hour/day/…
  const [offset, setOffset] = useState(0);
  const [events, setEvents] = useState<SensorEventStat[] | undefined>(undefined);
  const [chartGroupId, setChartGroupId] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<ChartMode>("sensor");
  const [chipChartOpen, setChipChartOpen] = useState(false);
  const counts = useRef<Record<number, number>>({});
  const chartEvents = events !== undefined && period.step === 0 ? withGaps(events) : events;
  const loadId = useRef(0);

  // loadEvents fetches the chart; a slower earlier request can't overwrite it.
  function loadEvents(p: ChartPeriod, pageOffset: number) {
    const id = ++loadId.current;
    setEvents(undefined);
    counts.current = {};
    const scale = p.step === 0 ? "raw" : `${p.step}s`;
    api.sensorsConfigurable(deviceId, `${p.window}s`, scale, pageEnd(p.window, pageOffset)).then(loaded => {
      if (id === loadId.current) setEvents(loaded);
    });
  }

  useEffect(() => {
    const index = defaultPeriodIndex(periods);
    setPeriodIndex(index);
    setOffset(0);
    setChartGroupId(null);
    setChartMode("sensor");
    setChipChartOpen(false);

    if (device.isIrRemote()) {
      setEvents(undefined);
    } else {
      loadEvents(periods[index], 0);
    }
  }, [deviceId]);

  useEffect(() => {
    if (!latestSensorEvent || latestSensorEvent.deviceId !== deviceId || offset !== 0) return;
    const e = latestSensorEvent;
    setEvents(prev => prev ? upsertBucket(prev, e, chartStep(prev, period.step), period.window, counts.current) : prev);
  }, [latestSensorEvent]);

  function changePeriod(index: number) {
    if (index === periodIndex) return;
    setPeriodIndex(index);
    setOffset(0);
    loadEvents(periods[index], 0);
  }

  function changeOffset(newOffset: number) {
    setOffset(newOffset);
    loadEvents(period, newOffset);
  }

  const oldest = device.sensorHistory?.oldest;
  const prevEnd = pageEnd(period.window, offset + 1)!;
  const currentEnd = pageEnd(period.window, offset);
  const periodControls = (
    <>
      <ButtonSelector
        options={periods.map((_, i) => String(i))}
        labels={periods.map(p => formatDuration(t, p.window))}
        current={String(Math.min(periodIndex, periods.length - 1))}
        onChange={(v) => changePeriod(+v)}
      />
      <ButtonGroup size="sm" className="mb-3">
        <Button variant="outline-secondary" onClick={() => changeOffset(offset + 1)} disabled={oldest != null && prevEnd <= oldest} aria-label={t("devicePage.earlier")}>
          <i className="fa fa-chevron-left" />
        </Button>
        <Button variant="outline-secondary" disabled className="text-nowrap">
          {currentEnd === undefined ? t("devicePage.latest") : pageLabel(period.window, currentEnd)}
        </Button>
        <Button variant="outline-secondary" onClick={() => changeOffset(offset - 1)} disabled={offset === 0} aria-label={t("devicePage.later")}>
          <i className="fa fa-chevron-right" />
        </Button>
      </ButtonGroup>
    </>
  );

  // Chart tabs for what the device reports (now or in the loaded range), not what its type implies.
  const chartGroups = CHART_GROUPS.filter(g => g.metrics.some(k =>
    device.state[k] != null || chartEvents?.some(r => r.get(k, "Avg") != null)));
  const chartGroup = chartGroups.find(g => g.id === chartGroupId) ?? chartGroups[0];

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

      { device.profile.features.chipTemp && chipChartOpen && <ChipTemperature key={"chip-" + device.id} api={api} device={device} latestSensorEvent={latestSensorEvent} /> }

      { device.isIrRemote() && <IrPanel key={"ir-" + device.id} api={api} device={device} devices={devices} /> }

      { device.hasSensorData() && (
        <>
          <MetricTiles device={device} />

          <div className="row">
            <div className="d-flex flex-wrap column-gap-2 align-items-center">
              {periodControls}
              {chartMode === "sensor" && chartGroups.length > 1 && chartGroup && (
                <ButtonSelector options={chartGroups.map(g => g.id)} labels={chartGroups.map(g => t(g.labelKey))} current={chartGroup.id} onChange={setChartGroupId} />
              )}
              <ButtonSelector options={["sensor", "online"] as ChartMode[]} labels={[t("devicePage.sensor"), t("devicePage.online")]} current={chartMode} onChange={setChartMode} />
            </div>
            {chartMode === "sensor" && (chartEvents === undefined ? <ChartSpinner /> : <ChartMetrics events={chartEvents} window={period.window} metrics={chartGroup?.metrics ?? []} />)}
            {chartMode === "online" && (chartEvents === undefined ? <ChartSpinner /> : <ChartOnline  events={chartEvents} window={period.window} />)}
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

type ChartProperties = { events: SensorEventStat[]; window: number };

function ChartOnline({ events, window }: ChartProperties) {
  const data = {
    labels: chartLabels(events.map(r => r.time), window),
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
    ...lineChartBase,
    plugins: { tooltip: indexTooltip },
    scales: {
      x: timeAxis,
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
function ChartMetrics({ events, window, metrics }: ChartProperties & { metrics: MetricKey[] }) {
  const { t } = useTranslation();
  const shown = metrics.map(k => METRIC_BY_KEY[k]).filter(m => events.some(r => r.get(m.key, "Avg") != null));
  if (shown.length === 0) {
    return <div className="text-center text-muted py-5">{t("devicePage.noData")}</div>;
  }

  const round = (m: Metric, v: number | null) => v == null || m.precision === undefined ? v : +v.toFixed(m.precision);
  const series = (m: Metric, kind: StatKind) => events.map(r => round(m, r.get(m.key, kind)));
  const axisIds = ["y", "y1"];

  const datasets = shown.flatMap((m, i) => {
    // A point whose min equals its max (a raw reading, or a bucket with one reading) has no
    // range: drop it from the band so it isn't drawn or listed in the tooltip.
    const rawMin = series(m, "Min");
    const rawMax = series(m, "Max");
    const flat = rawMin.map((v, j) => v == null || rawMax[j] == null || v === rawMax[j]);
    const min = rawMin.map((v, j) => flat[j] ? null : v);
    const max = rawMax.map((v, j) => flat[j] ? null : v);
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

  const scales: Record<string, object> = { x: timeAxis };
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
    ...lineChartBase,
    plugins: { legend: hideBandLegend, tooltip: indexTooltip },
    scales,
  };

  return <Line data={{ labels: chartLabels(events.map(r => r.time), window), datasets }} options={options} />;
}
