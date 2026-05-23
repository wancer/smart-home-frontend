"use client";

import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Modal, Row, Col, Button } from "react-bootstrap";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineController,
  LinearScale,
  CategoryScale,
  PointElement,
  LineElement,
  Filler,
} from "chart.js";
import DeviceEvent from "../api/types/device";
import { CHART_COLORS } from "../chart-colors";
import PowerIcon from "../element/power-icon";
import HttpApi from "../api/http";
import { DataPoint, HistoryMap } from "../App";

ChartJS.register(LineController, LinearScale, CategoryScale, PointElement, LineElement, Filler);

type DashboardProperties = {
  devices: DeviceEvent[];
  historyMap: HistoryMap;
  api: HttpApi;
};

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

function DeviceBlock({ device, history, api }: { device: DeviceEvent; history: DataPoint[] | undefined; api: HttpApi }) {
  const { t } = useTranslation();
  const [toggling, setToggling] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const toggle = async () => {
    setToggling(true);
    try {
      await api.control(device.id, "on-off", device.state.on ? "OFF" : "ON");
    } finally {
      setToggling(false);
    }
  };

  let sparkline: React.ReactNode = null;
  if (history === undefined) {
    sparkline = <SparklineSpinner />;
  } else if (device.isEnergySensor()) {
    sparkline = <MiniSparkline points={history} borderColor={CHART_COLORS.power.border} backgroundColor={CHART_COLORS.power.background} />;
  } else if (device.isCo2Sensor()) {
    sparkline = <MiniSparkline points={history} borderColor={CHART_COLORS.co2.border} backgroundColor={CHART_COLORS.co2.background} />;
  } else if (device.isThSensor()) {
    sparkline = <MiniSparkline points={history} borderColor={CHART_COLORS.temperature.border} backgroundColor={CHART_COLORS.temperature.background} />;
  }

  return (
    <div className="col-md-6 col-sm-6 col-xs-12">
      <div className="row">
        <h2 className="d-flex align-items-center gap-2">
          <Link to={"/device/" + device.id} className="text-decoration-none text-reset">
            <PowerIcon device={device} />
            <strong>{device.name}</strong>
          </Link>
          {device.supportsToggle && device.state.on !== null && (
            <Button variant="outline-secondary" size="sm" title={t('configPanel.section_power')} onClick={e => { e.preventDefault(); setShowModal(true); }} className="ms-auto">
              <i className="fa fa-power-off" />
            </Button>
          )}
        </h2>
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
        <div className="col-5">
          {sparkline}
        </div>
        <div className="col-7 font-monospace" style={{ textAlign: "right" }}>
          {device.isEnergySensor() && (
            <h1>
              <strong> {device.state.power} W </strong>
              <br />
              <strong> {device.state.current} A </strong>
              <br />
              <strong> {device.state.voltage} V </strong>
            </h1>
          )}
          {device.isCo2Sensor() && (
            <h1>
              <strong> {device.state.temperature} ° </strong>
              <br />
              <strong> {device.state.humidity} % </strong>
              <br />
              <strong> {device.state.co2} ppm </strong>
            </h1>
          )}
          {device.isThSensor() && (
            <h1>
              <strong> {device.state.temperature} ° </strong>
              <br />
              <strong> {device.state.humidity} % </strong>
              <br />
            </h1>
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

export function DashboardPage({ devices, historyMap, api }: DashboardProperties) {
  return (
    <>
      <div className="row">
        {Object.values(devices).filter((d) => d.enabled).map((device: DeviceEvent) => (
          <DeviceBlock
            key={"dashboard-block-" + device.id}
            device={device}
            history={historyMap[device.id]}
            api={api}
          />
        ))}
      </div>
    </>
  );
}
