"use client";

import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

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
} from "chart.js";

import { Bar } from "react-chartjs-2";

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
import { Col } from "react-bootstrap";

type DeviceProperties = {
  api: HttpApi;
};

export function DevicePage({ api }: DeviceProperties) {
  const { idStr } = useParams();
  const deviceId = typeof idStr === "undefined" ? 0 : +idStr;

  const [isLoading, setLoading] = useState(true); // Loading state
  const [device, setDevice] = useState<DeviceEvent>(new DeviceEvent({ state: {} }));
  const [eventsMonthly, setEventsMonthly] = useState<SensorDailyEvent[]>([]);
  const [events7day, setEvents7day] = useState<SensorEventStat[]>([]);
  const [events5min, setEvents5min] = useState<SensorEventStat[]>([]);
  const [events1min, setEvents1min] = useState<SensorEventStat[]>([]);

  useEffect(() => {
    api.device(deviceId).then((device) => {
      setDevice(device);
      setLoading(false);
    });

    api.sensorsDaily(deviceId).then(setEventsMonthly);
    api.sensorsConfigurable(deviceId, (7 * 24) + "h", "1h").then(setEvents7day);
    api.sensorsConfigurable(deviceId, "24h", "5m").then(setEvents5min);
    api.sensorsConfigurable(deviceId, "1h", "1m").then(setEvents1min);
  }, [deviceId]);

  useEffect(() => {
    
  }, [device]);

  if (isLoading) {
    return <>Loading...</>;
  }

  return (
    <>
      <div className="row">
        <h2>
          <i
            className={
              "fa fa-plug " + (device.state.on ? "text-success" : "text-danger")
            }
          ></i>
          {device.name}

          <Link to={"/device/" + device.id + "/control"} className="">
            <i className={"fa fa-cog text-primary"}></i>
          </Link>
        </h2>
      </div>

      <div className="row">
        <RealtimeTable device={device} />
      </div>

      <div className="row">
        <div className="row">
          <h2>
            <strong>Power 1h / 1m</strong>
          </h2>
        </div>
        <ChartPower events={events1min} />
      </div>

      <div className="row">
        <div className="row">
          <h2>
            <strong>Consumption 24h / 5min</strong>
          </h2>
        </div>
        <ChartConsumption events={events5min} />
      </div>

      <div className="row">
        <div className="row">
          <h2>
            <strong>Power 24h / 5min</strong>
          </h2>
        </div>
        <ChartPower events={events5min} />
      </div>

      <div className="row">
        <div className="row">
          <h2>
            <strong>Electricity on/off 24h / 5min</strong>
          </h2>
        </div>
        <ChartElectricityOnOff events={events5min} />
      </div>

      <div className="row">
        <div className="row">
          <h2>
            <strong>Consumption W*h 7d / 1h</strong>
          </h2>
        </div>
        <ChartConsumption events={events7day} />
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
  );
}

type ChartRealtimeProperties = {
  device: DeviceEvent;
};

function RealtimeTable({ device }: ChartRealtimeProperties) {
  return (
    <>
      <div className="row font-monospace">
        <Col xs={4}>
        <h1><strong> {device.state.power} W </strong></h1>
        </Col>
        <Col xs={4}>
        <h1><strong> {device.state.current} A </strong></h1>
        </Col>
        <Col xs={4}>
        <h1><strong> {device.state.voltage} V </strong></h1>
        </Col>
      </div>
    </>
  );
}

type DailyChartProperties = {
  dailyEvents: SensorDailyEvent[],
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

function ChartElectricityOnOff({ events }: {events: SensorEventStat[]}) {
  const data = {
    labels: events.map((record) => record.time),
    datasets: [
      {
        label: "On",
        borderColor: "rgb(4, 123, 0)",
        backgroundColor: "rgba(47, 255, 0, 0.5)",
        fill: true,
        data: events.map((record) => record.currentAvg === null ? 0 : 1),
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

function ChartConsumption({ events }: {events: SensorEventStat[]}) {
  const data = {
    labels: events.map((record) => record.time),
    datasets: [
      {
        label: "W*h",
        borderColor: "rgb(53, 0, 123)",
        backgroundColor: "rgba(157, 0, 255, 0.5)",
        fill: true,
        data: events.map((record) => record.powerConsumed),
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

function ChartPower({ events }: {events: SensorEventStat[]}) {
  const data = {
    labels: events.map((record) => record.time),
    datasets: [
      {
        label: "W",
        borderColor: "rgb(123, 0, 0)",
        backgroundColor: "rgba(255, 0, 0, 0.5)",
        fill: true,
        data: events.map((record) => record.powerAvg),
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
