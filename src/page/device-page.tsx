"use client";

import { useEffect, useState } from "react";
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

export function DevicePage({ api, devices }: DevicePageProperties) {
  const { idStr } = useParams();
  const deviceId = typeof idStr === "undefined" ? 0 : +idStr;

  let device = devices[deviceId];

  const [eventsMonthly, setEventsMonthly] = useState<SensorDailyEvent[]>([]);
  const [events5min, setEvents5min] = useState<SensorEventStat[]>([]);
  const [events1min, setEvents1min] = useState<SensorEventStat[]>([]);
  useEffect(() => {
    setEvents5min([]);
    setEvents1min([]);

    api.sensorsDaily(deviceId).then(setEventsMonthly);
    api.sensorsConfigurable(deviceId, "24h", "5m").then(setEvents5min);
    api.sensorsConfigurable(deviceId, "1h", "1m").then(setEvents1min);
  }, [deviceId]);

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
            <div className="row">
              <h2>
                <strong>1h / 1m</strong>
              </h2>
            </div>
            <ChartAllInOne events={events1min} />
          </div>

          <div className="row">
            <div className="row">
              <h2>
                <strong>24h / 5min</strong>
              </h2>
            </div>
            <ChartAllInOne events={events5min} />
          </div>

          <div className="row">
            <div className="row">
              <h2>
                <strong>Consumption W*h 30d / 1d</strong>
              </h2>
            </div>
            <ChartDailyConsumption dailyEvents={eventsMonthly} />
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
            <div className="row">
              <h2>
                <strong>1h / 1m</strong>
              </h2>
            </div>
            <ChartCo2 events={events1min} />
          </div>

          <div className="row">
            <div className="row">
              <h2>
                <strong>24h / 5min</strong>
              </h2>
            </div>
            <ChartCo2 events={events5min} />
          </div>


          <div className="row">
            <div className="row">
              <h2>
                <strong>1h / 1m</strong>
              </h2>
            </div>
            <ChartTH events={events1min} />
          </div>

          <div className="row">
            <div className="row">
              <h2>
                <strong>24h / 5min</strong>
              </h2>
            </div>
            <ChartTH events={events5min} />
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
            <div className="row">
              <h2>
                <strong>1h / 1m</strong>
              </h2>
            </div>
            <ChartTH events={events1min} />
          </div>

          <div className="row">
            <div className="row">
              <h2>
                <strong>24h / 5min</strong>
              </h2>
            </div>
            <ChartTH events={events5min} />
          </div>
        </>
      ) }
    </>
  );
}

type DailyChartProperties = {
  dailyEvents: SensorDailyEvent[];
};

function ChartDailyConsumption({ dailyEvents }: DailyChartProperties) {
  const data = {
    labels: dailyEvents.map((dailyEvent) => dailyEvent.date),
    datasets: [
      {
        label: "W*h",
        borderColor: "rgb(53, 0, 123)",
        backgroundColor: "rgba(157, 0, 255, 0.5)",
        fill: true,
        data: dailyEvents.map((dailyEvent) => dailyEvent.power),
      },
    ],
  };
  const options = {
    responsive: true,
    animation: {
      duration: 0,
    },
  };

  return <Bar data={data} options={options} />;
}

function ChartAllInOne({ events }: { events: SensorEventStat[] }) {
  const data = {
    labels: events.map((record) => record.time),
    datasets: [
      {
        label: "On",
        borderColor: "rgb(4, 123, 0)",
        backgroundColor: "rgba(47, 255, 0, 0.5)",
        fill: true,
        data: events.map((record) => (record.currentAvg === null ? 0 : 1)),
      },
      {
        label: "W",
        borderColor: "rgb(123, 0, 0)",
        backgroundColor: "rgba(255, 0, 0, 0.5)",
        fill: true,
        data: events.map((record) => record.powerAvg),
      },
      {
        label: "W*h",
        borderColor: "rgb(53, 0, 123)",
        backgroundColor: "rgba(157, 0, 255, 0.5)",
        fill: true,
        data: events.map((record) => record.powerConsumed),
      },
      {
        label: "A",
        borderColor: "rgb(0, 25, 123)",
        backgroundColor: "rgba(0, 72, 255, 0.5)",
        fill: true,
        data: events.map((record) => record.currentAvg),
      },
    ],
  };
  const options = {
    responsive: true,
    animation: {
      duration: 0,
    },
    plugins: {
      tooltip: {
        intersect: false,
        includeInvisible: true,
        mode: "index" as InteractionMode,
      },

    },
  };

  return <Bar data={data} options={options} />;
}

function ChartCo2({ events }: { events: SensorEventStat[] }) {
  const data = {
    labels: events.map((record) => record.time),
    datasets: [
      {
        label: "eCO₂ ppm",
        borderColor: "rgb(4, 123, 0)",
        backgroundColor: "rgba(47, 255, 0, 0.5)",
        fill: true,
        data: events.map((record) => record.co2eAvg),
      },
    ],
  };
  const options = {
    responsive: true,
    animation: {
      duration: 0,
    },
    stacked: false,
    plugins: {
      tooltip: {
        intersect: false,
        includeInvisible: true,
        mode: "index" as InteractionMode,
      },
    },
  };

  return <Line data={data} options={options} />;
}



function ChartTH({ events }: { events: SensorEventStat[] }) {
  const data = {
    labels: events.map((record) => record.time),
    datasets: [
      {
        label: "°C",
        borderColor: "rgb(123, 0, 0)",
        backgroundColor: "rgba(255, 0, 0, 0.5)",
        fill: true,
        data: events.map((record) => record.temperatureAvg),
      },
      {
        label: "H₂O %",
        borderColor: "rgb(53, 0, 123)",
        backgroundColor: "rgba(157, 0, 255, 0.5)",
        fill: true,
        data: events.map((record) => record.humidityAvg),
      },
    ],
  };
  const options = {
    responsive: true,
    animation: {
      duration: 0,
    },
    stacked: false,
    plugins: {
      tooltip: {
        intersect: false,
        includeInvisible: true,
        mode: "index" as InteractionMode,
      },
    },
  };

  return <Line data={data} options={options} />;
}

/*


function Footer() {
  return <footer>
          <ul className="list-inline">
            <li>
              <strong>Device name:</strong> device.name
            </li>
            <li>
              <strong>Model:</strong> device.model
            </li>
            <li>
              <strong>Sw ver:</strong> device.softwareVersion
            </li>
            <li>
              <strong>Hw ver:</strong> device.hardwareVersion
            </li>
          </ul>
        </footer> 
}
        */
