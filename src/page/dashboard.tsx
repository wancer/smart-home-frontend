import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Modal, Row, Col, Button, Form, Alert } from "react-bootstrap";
import { Line } from "react-chartjs-2";
import DeviceEvent, { DashboardView } from "../api/types/device";
import { CHART_COLORS } from "../chart-setup";
import { dashboardChartMetric, dashboardMetrics, formatMetric, Metric, MetricKey, METRICS } from "../metrics";
import PowerIcon from "../element/power-icon";
import HttpApi from "../api/http";
import { HistoryMap, HistoryPoint } from "../App";

type DataPoint = { time: number; value: number };

type DashboardProperties = {
  devices: DeviceEvent[];
  historyMap: HistoryMap;
  api: HttpApi;
  onDeviceChange: (device: DeviceEvent) => void;
};

/** "Power", "DC power", … (the notification rule labels). */
function metricLabel(t: TFunction, m: Metric): string {
  return t("notifications.metric_" + m.key.replace(/[A-Z]/g, c => "_" + c.toLowerCase()));
}

type ViewSettingsProps = {
  device: DeviceEvent;
  history: HistoryPoint[] | undefined;
  api: HttpApi;
  onClose: () => void;
  onSaved: (device: DeviceEvent) => void;
};

/** Picks the sparkline metric and the values shown on the dashboard block. */
function ViewSettingsModal({ device, history, api, onClose, onSaved }: ViewSettingsProps) {
  const { t } = useTranslation();
  const [chart, setChart] = useState<DashboardView["chart"]>(device.dashboard.chart);
  const [values, setValues] = useState<MetricKey[] | null>(device.dashboard.values);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // what the device reports now or recently, plus anything already picked
  const offered = METRICS.filter(m =>
    device.state[m.key] != null
    || history?.some(p => p[m.key] != null)
    || device.dashboard.chart === m.key
    || device.dashboard.values?.includes(m.key));

  const toggleValue = (key: MetricKey) => {
    const current = values ?? offered.filter(m => device.state[m.key] != null).map(m => m.key);
    const next = current.includes(key) ? current.filter(k => k !== key) : [...current, key];
    // keep display order
    setValues(METRICS.map(m => m.key).filter(k => next.includes(k)));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateDashboard(device.id, { chart, values });
      const copy = Object.assign(Object.create(Object.getPrototypeOf(device)), device) as DeviceEvent;
      copy.dashboard = updated.dashboard;
      onSaved(copy);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal show onHide={onClose}>
      <Modal.Header closeButton>
        <Modal.Title>{device.name}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {offered.length === 0 && <Alert variant="secondary">{t('dashboard.noMetrics')}</Alert>}
        <Form.Group className="mb-3">
          <Form.Label><strong>{t('dashboard.chart')}</strong></Form.Label>
          <Form.Select value={chart} onChange={e => setChart(e.target.value as DashboardView["chart"])}>
            <option value="">{t('dashboard.auto')}</option>
            <option value="none">{t('dashboard.noChart')}</option>
            {offered.map(m => <option key={m.key} value={m.key}>{metricLabel(t, m)}</option>)}
          </Form.Select>
        </Form.Group>
        <Form.Group>
          <Form.Label><strong>{t('dashboard.values')}</strong></Form.Label>
          <Form.Check type="switch" id={`dash-auto-${device.id}`} label={t('dashboard.allValues')}
            checked={values === null} onChange={() => setValues(values === null ? offered.filter(m => device.state[m.key] != null).map(m => m.key) : null)} />
          {offered.map(m => (
            <Form.Check key={m.key} id={`dash-${device.id}-${m.key}`} className="ms-3"
              label={`${metricLabel(t, m)} (${m.unit})`}
              disabled={values === null}
              checked={values === null ? device.state[m.key] != null : values.includes(m.key)}
              onChange={() => toggleValue(m.key)} />
          ))}
        </Form.Group>
        {error && <Alert variant="danger" className="mt-3 mb-0">{error}</Alert>}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>{t('dashboard.cancel')}</Button>
        <Button variant="primary" onClick={save} disabled={saving}>{saving ? t('dashboard.saving') : t('dashboard.save')}</Button>
      </Modal.Footer>
    </Modal>
  );
}

type SparklineProps = {
  points: DataPoint[];
  borderColor: string;
  backgroundColor: string;
};

function SparklineSpinner() {
  return (
    <div className="d-flex align-items-center justify-content-center" style={{ height: 80 }}>
      <div className="spinner-border spinner-border-sm" role="status">
        <span className="visually-hidden">Loading...</span>
      </div>
    </div>
  );
}

function MiniSparkline({ points, borderColor, backgroundColor }: SparklineProps) {
  if (points.length < 2) return <div style={{ height: 80 }} />;

  const now = Date.now() / 1000;
  const data = {
    labels: points.map(p => {
      const diff = Math.round(now - p.time);
      return diff < 60 ? `${diff}s` : `${Math.floor(diff / 60)}m`;
    }),
    datasets: [
      {
        data: points.map(p => p.value),
        borderColor,
        backgroundColor,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 1.5,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 0 },
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
    },
    scales: {
      x: {
        display: true,
        ticks: {
          maxTicksLimit: 4,
          maxRotation: 0,
          font: { size: 9 },
        },
        grid: { drawOnChartArea: false },
      },
      y: {
        display: true,
        position: "left" as const,
        ticks: {
          maxTicksLimit: 3,
          font: { size: 9 },
        },
        grid: { drawOnChartArea: false },
      },
    },
  };

  return (
    <div style={{ height: 80, position: "relative" as const }}>
      <Line data={data} options={options} />
    </div>
  );
}

type DeviceBlockProps = {
  device: DeviceEvent;
  history: HistoryPoint[] | undefined;
  api: HttpApi;
  onDeviceChange: (device: DeviceEvent) => void;
};

function DeviceBlock({ device, history, api, onDeviceChange }: DeviceBlockProps) {
  const { t } = useTranslation();
  const [toggling, setToggling] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const toggle = async () => {
    setToggling(true);
    try {
      await api.control(device.id, "on-off", device.state.on ? "OFF" : "ON");
    } finally {
      setToggling(false);
    }
  };

  const values = dashboardMetrics(device.dashboard, device.state);
  // with an auto chart, follow the newest record's metric when the state has none
  const newest = history && history.length > 0 ? history[history.length - 1] : undefined;
  const sparkMetric = dashboardChartMetric(device.dashboard, device.state, newest);
  const sparkColor = sparkMetric?.color ?? CHART_COLORS.online;
  const points: DataPoint[] = sparkMetric && history
    ? history.flatMap(p => { const v = p[sparkMetric.key]; return v != null ? [{ time: p.time, value: v }] : []; })
    : [];
  const sparkline = !device.hasSensorData() || (device.dashboard.chart === "none")
    ? null
    : history === undefined
      ? <SparklineSpinner />
      : <MiniSparkline points={points} borderColor={sparkColor.border} backgroundColor={sparkColor.background} />;
  // multi-sensors can report many values; keep the block from growing too tall
  const ValueTag = values.length > 3 ? "h3" : "h1";

  return (
    <div className="col-md-6 col-sm-6 col-xs-12">
      <div className="row">
        <h2 className="d-flex align-items-center gap-2">
          <Link to={"/device/" + device.id} className="text-decoration-none text-reset">
            <PowerIcon device={device} />
            <strong>{device.name}</strong>
          </Link>
          <span className="ms-auto d-flex gap-2">
            {device.supportsToggle && device.state.on !== null && (
              <Button variant="outline-secondary" size="sm" title={t('configPanel.section_power')} onClick={e => { e.preventDefault(); setShowModal(true); }}>
                <i className="fa fa-power-off" />
              </Button>
            )}
            <Button variant="outline-secondary" size="sm" title={t('dashboard.settings')} onClick={() => setShowSettings(true)}>
              <i className="fa fa-sliders" />
            </Button>
          </span>
        </h2>
        {showSettings && (
          <ViewSettingsModal device={device} history={history} api={api}
            onClose={() => setShowSettings(false)} onSaved={onDeviceChange} />
        )}
        <Modal show={showModal} onHide={() => setShowModal(false)}>
          <Modal.Header closeButton>
            <Modal.Title>{device.name}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Row className="align-items-center">
              <Col xs="auto">{t('configPanel.on')}</Col>
              <Col xs="auto">
                <button onClick={toggle} disabled={toggling} style={{ background: "none", border: "none", padding: 0, cursor: toggling ? "wait" : "pointer" }}>
                  <i
                    className={"fa " + (device.state.on ? "fa-toggle-on text-success" : "fa-toggle-off text-danger")}
                    style={{ fontSize: 32 }}
                  />
                </button>
              </Col>
            </Row>
          </Modal.Body>
        </Modal>
      </div>
      <div className="row align-items-center">
        {sparkline && (
          <div className="col-5">
            {sparkline}
          </div>
        )}
        <div className={(sparkline ? "col-7" : "col-12") + " font-monospace"} style={{ textAlign: "right" }}>
          {values.length > 0 && (
            <ValueTag>
              {values.map(m => (
                <div key={m.key}>
                  <strong> {formatMetric(m, device.state[m.key] as number)} {m.key === "temperature" ? "°" : m.unit} </strong>
                  {m.tag && <small className="text-muted fs-6">{m.tag}</small>}
                </div>
              ))}
            </ValueTag>
          )}
          {device.state.last > 0 && (
            <small className="text-muted">
              {t('dashboard.updated')} {new Date(device.state.last * 1000).toLocaleTimeString()}
            </small>
          )}
        </div>
      </div>
    </div>
  );
}

export function DashboardPage({ devices, historyMap, api, onDeviceChange }: DashboardProperties) {
  return (
    <>
      <div className="row">
        {Object.values(devices).filter((d) => d.enabled && !d.isIrRemote())
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }))
          .map((device: DeviceEvent) => (
          <DeviceBlock
            key={"dashboard-block-" + device.id}
            device={device}
            history={historyMap[device.id]}
            api={api}
            onDeviceChange={onDeviceChange}
          />
        ))}
      </div>
    </>
  );
}
