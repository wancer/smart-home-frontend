import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { Button, ButtonGroup, Col } from "react-bootstrap";
import DeviceConfigPanel from "../element/device-config-panel.tsx";
import { Line } from "react-chartjs-2";

import DeviceEvent from "../api/types/device.ts";
import { CHART_COLORS, ChartColor, indexTooltip, lineChartBase, timeAxis } from "../chart-setup.ts";
import HttpApi from "../api/http.ts";
import SensorEventStat from "../api/types/sensor-event-stat.ts";
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
  const [co2Chart, setCo2Chart] = useState<Co2Chart>("co2");
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
    setCo2Chart("co2");
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
    setEvents(prev => prev ? upsertBucket(prev, e, chartStep(prev, period.step), period.window, counts.current, device) : prev);
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

      { device.isEnergySensor() && (
        <>
          <CurrentValues values={[[device.state.power, "W"], [device.state.current, "A"], [device.state.voltage, "V"]]} />

          <div className="row">
            <div className="d-flex flex-wrap column-gap-2 align-items-center">
              {periodControls}
              <ButtonSelector options={["sensor", "online"] as ChartMode[]} labels={[t("devicePage.sensor"), t("devicePage.online")]} current={chartMode} onChange={setChartMode} />
            </div>
            {chartMode === "sensor" && (chartEvents === undefined ? <ChartSpinner /> : <ChartPower events={chartEvents} window={period.window} />)}
            {chartMode === "online" && (chartEvents === undefined ? <ChartSpinner /> : <ChartOnline events={chartEvents} window={period.window} />)}
          </div>
        </>
      ) }

      { device.isCo2Sensor() && (
        <>
          <CurrentValues values={[[device.state.temperature, "°C"], [device.state.humidity, "%"], [device.state.co2, "ppm"]]} />

          <div className="row">
            <div className="d-flex flex-wrap column-gap-2 align-items-center">
              {periodControls}
              {chartMode === "sensor" && <ButtonSelector options={["co2", "th"]} labels={["CO₂", "T&H"]} current={co2Chart} onChange={setCo2Chart} />}
              <ButtonSelector options={["sensor", "online"] as ChartMode[]} labels={[t("devicePage.sensor"), t("devicePage.online")]} current={chartMode} onChange={setChartMode} />
            </div>
            {chartMode === "sensor" && co2Chart === "co2" && (chartEvents === undefined ? <ChartSpinner /> : <ChartCo2    events={chartEvents} window={period.window} />)}
            {chartMode === "sensor" && co2Chart === "th"  && (chartEvents === undefined ? <ChartSpinner /> : <ChartTH     events={chartEvents} window={period.window} />)}
            {chartMode === "online"                       && (chartEvents === undefined ? <ChartSpinner /> : <ChartOnline events={chartEvents} window={period.window} />)}
          </div>
        </>
      ) }

      { device.isThSensor() && (
        <>
          <CurrentValues values={[[device.state.temperature, "°C"], [device.state.humidity, "%"]]} />

          <div className="row">
            <div className="d-flex flex-wrap column-gap-2 align-items-center">
              {periodControls}
              <ButtonSelector options={["sensor", "online"] as ChartMode[]} labels={[t("devicePage.sensor"), t("devicePage.online")]} current={chartMode} onChange={setChartMode} />
            </div>
            {chartMode === "sensor" && (chartEvents === undefined ? <ChartSpinner /> : <ChartTH     events={chartEvents} window={period.window} />)}
            {chartMode === "online" && (chartEvents === undefined ? <ChartSpinner /> : <ChartOnline events={chartEvents} window={period.window} />)}
          </div>
        </>
      ) }
    </>
  );
}

/** Current readings in large type, as [value, unit] pairs; a missing value shows just the unit. */
function CurrentValues({ values }: { values: [number | null | undefined, string][] }) {
  return (
    <div className="row">
      <div className="row font-monospace">
        {values.map(([value, unit]) => (
          <Col xs={4} key={unit}>
            <h1><strong>{value} {unit}</strong></h1>
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

function ChartPower({ events, window }: ChartProperties) {
  const data = {
    labels: chartLabels(events.map(r => r.time), window),
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
    ...lineChartBase,
    plugins: { legend: hideBandLegend, tooltip: indexTooltip },
    scales: {
      x: timeAxis,
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

function ChartCo2({ events, window }: ChartProperties) {
  const data = {
    labels: chartLabels(events.map(r => r.time), window),
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
    ...lineChartBase,
    plugins: { legend: hideBandLegend, tooltip: indexTooltip },
    scales: {
      x: timeAxis,
      y: {
        min: 400,
        title: { display: true, text: "ppm" },
      },
    },
  };

  return <Line data={data} options={options} />;
}

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
        data: events.map((r) =>
          r.powerAvg != null || r.co2Avg != null || r.temperatureAvg != null ? 1 : 0
        ),
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

function ChartTH({ events, window }: ChartProperties) {
  const data = {
    labels: chartLabels(events.map(r => r.time), window),
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
    ...lineChartBase,
    plugins: { legend: hideBandLegend, tooltip: indexTooltip },
    scales: {
      x: timeAxis,
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
