import {
  useParams,
} from "react-router-dom";
import Device from "../device.ts";
import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  TooltipContentProps,
  RadialBarChart, RadialBar, Legend,
} from "recharts";

import {Record} from "../sensor.ts"
import {MenuRow} from "./menu-row.tsx"

type DeviceProperties = {
  devices: Device[];
  records: any;
  lastEvents: object[];
};


function GetById(devices: Device[], id: number): Device {
  return devices.find((device: Device): boolean => device.id === id);
}

export function DevicePage({ devices, records, lastEvents }: DeviceProperties) {
  const { id: idRaw } = useParams();
  if (typeof idRaw === "undefined") {
    return <></>;
  }
  if (devices.length === 0) {
    return <></>;
  }

  const radialData = [
      {
    name: '18-24',
    uv: 31.47,
    pv: 21512,
    fill: '#8884d8',
  },
      {
    name: '22-33',
    uv: 111,
    pv: 2400,
    fill: '#8884d8',
  },
  ];

  const id = parseInt(idRaw);
  const device = GetById(devices, id);

  const now = Date.now();
  const recentRecords = records
    .filter((r: Record) => r.DeviceId === device.id)
    .sort((a: Record, b: Record) => b.DeviceTime - a.DeviceTime)
    .slice(0, 4 * 60 * 24) // 4 data points per minute
    .map((a: Record): object => {
      const date = new Date(a.DeviceTime * 1000);
      return {
        axisText: date.getHours() + ":" + date.getMinutes(),
        tooltipText:
          date.getFullYear() +
          "-" +
          date.getMonth() +
          "-" +
          date.getDate() +
          " " +
          date.getHours() +
          ":" +
          date.getMinutes(),
        power: a.Power,
      };
    });
  const CustomTooltip = ({ active, payload, label }: TooltipContentProps) => {
    if (payload.length > 0) {
      const data = payload[0].payload;
      return <>{data.tooltipText}</>;
    }
    return <>dsadas</>;
  };

  return (
    <div className="right_col" role="main">
      <div className="page-header">
        <div className="row">
          <div className="col-sm-8">
            <div className="device-list-small">
              <ul className="list-inline">
                {devices.map((device: Device) => MenuRow(device))}
              </ul>
            </div>
            <h1>
              <i className="fa fa-plug"></i> {device.name}
            </h1>
          </div>
          <div className="col-sm-4">
            <div
              id="connection-error"
              className="alert alert-danger"
              style={{ display: "none" }}
            >
              Connection lost. Attempting to re-establish...
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-md-4 col-sm-4 col-xs-12">
          <div className="x_panel tile">
            <div className="x_title">
              <h2>
                <strong>Realtime Usage</strong>
              </h2>
              <div className="clearfix"></div>
            </div>
            <div className="x_content">
              <div className="row">
                <h1 className="text-center">
                  <strong id="rtu-power">{lastEvents[device.id] ? lastEvents[device.id].Power : (<>-</>)} W</strong>
                </h1>
              </div>
              <div className="row text-center">
                <div>
                    <RadialBarChart
                      style={{ width: '100%', aspectRatio: 1.5, maxHeight: 150 }}
                      responsive
                      cx="30%"
                      barSize={14}
                      data={radialData}
                    >
                      <RadialBar label={{ position: 'insideStart', fill: '#fff' }} background dataKey="uv" />
                      <Legend iconSize={10} layout="vertical" verticalAlign="middle" />
                      <Tooltip />
                    </RadialBarChart>
                </div>
              </div>
              <div className="row">
                <div className="col-md-6 col-xs-6 text-center">
                  <h1>
                  <strong id="rtu-power">{lastEvents[device.id] ? lastEvents[device.id].Current : (<>-</>)} A</strong>
                  </h1>
                </div>
                <div className="col-md-6 col-xs-6 text-center">
                  <h1>
                  <strong id="rtu-power">{lastEvents[device.id] ? lastEvents[device.id].Voltage : (<>-</>)} V</strong>
                  </h1>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-8 col-sm-8 col-xs-12">
          <div className="x_panel tile">
            <div className="x_title">
              <h2>
                <strong>Realtime Trend</strong>
              </h2>
              <div className="clearfix"></div>
            </div>
            <div className="x_content">
              <AreaChart
                style={{ width: "100%", aspectRatio: 3.0, margin: "auto" }}
                responsive
                data={recentRecords}
              >
                <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
                <XAxis
                  dataKey="axisText"
                  angle={45}
                  textAnchor="middle"
                  height={100}
                  tick={{ fontSize: 10 }}
                />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="power"
                  stroke="#075a01"
                  fill="#00d515"
                  name="Power (W)"
                  animationDuration={0}
                />
              </AreaChart>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-md-12 col-sm-12 col-xs-12">
          <div className="x_panel tile">
            <div className="x_title">
              <h2>
                <strong>Logged Usage (24h)</strong>
              </h2>
            </div>
            <div className="x_content">
              <AreaChart
                style={{ width: "100%", aspectRatio: 5.0, margin: "auto" }}
                responsive
                data={recentRecords}
              >
                <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
                <XAxis
                  dataKey="axisText"
                  angle={45}
                  textAnchor="middle"
                  height={100}
                  tick={{ fontSize: 10 }}
                />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="power"
                  stroke="#075a01"
                  fill="#00d515"
                  name="Power (W)"
                  animationDuration={0}
                />
              </AreaChart>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-md-4 col-sm-4 col-xs-12 col-lg-4 col-xl-2">
          <div className="x_panel small tile">
            <div className="x_title">
              <h2>
                <strong>Plug state</strong>
              </h2>
              <div className="clearfix"></div>
            </div>
            <div className="x_content small">
              <h1>
                <span id="power-state">-</span>
              </h1>
            </div>
          </div>
        </div>

        <div className="col-md-4 col-sm-4 col-xs-12 col-lg-4 col-xl-2">
          <div className="x_panel small tile">
            <div className="x_title">
              <h2>
                <strong>Uptime</strong>
              </h2>
              <div className="clearfix"></div>
            </div>
            <div className="x_content small">
              <h1 id="uptime">-</h1>
            </div>
          </div>
        </div>

        <div className="col-md-4 col-sm-4 col-xs-12 col-lg-4 col-xl-2">
          <div className="x_panel small tile">
            <div className="x_title">
              <h2>
                <strong>Total today</strong>
              </h2>
              <div className="clearfix"></div>
            </div>
            <div className="x_content small">
              <h1>
                <span id="total-day">-</span> <small>kWH</small>
              </h1>
            </div>
          </div>
        </div>

        <div className="col-md-4 col-sm-4 col-xs-12 col-lg-4 col-xl-2">
          <div className="x_panel small tile">
            <div className="x_title">
              <h2>
                <strong>Total this month</strong>
              </h2>
              <div className="clearfix"></div>
            </div>
            <div className="x_content small">
              <h1>
                <span id="total-month">-</span> <small>kWH</small>
              </h1>
            </div>
          </div>
        </div>

        <div className="col-md-4 col-sm-4 col-xs-12 col-lg-4 col-xl-2">
          <div className="x_panel small tile">
            <div className="x_title">
              <h2>
                <strong>Daily avg</strong>
              </h2>
              <div className="clearfix"></div>
            </div>
            <div className="x_content small">
              <h1>
                <span id="avg-day">-</span> <small>kWH</small>
              </h1>
            </div>
          </div>
        </div>

        <div className="col-md-4 col-sm-4 col-xs-12 col-lg-4 col-xl-2">
          <div className="x_panel small tile">
            <div className="x_title">
              <h2>
                <strong>Monthly avg</strong>
              </h2>
              <div className="clearfix"></div>
            </div>
            <div className="x_content small">
              <h1>
                <span id="avg-month">-</span> <small>kWH</small>
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-md-8 col-sm-8 col-xs-12">
          <div className="x_panel tile">
            <div className="x_title">
              <h2>
                <strong>Last 30 days (kWH)</strong>
              </h2>
              <div className="clearfix"></div>
            </div>
            <div className="x_content">
              <canvas id="du-chart" height="270"></canvas>
            </div>
          </div>
        </div>

        <div className="col-md-4 col-sm-4 col-xs-12">
          <div className="x_panel tile">
            <div className="x_title">
              <h2>
                <strong>Last 12 months (kWH)</strong>
              </h2>
              <div className="clearfix"></div>
            </div>
            <div className="x_content">
              <canvas id="mu-chart" height="270"></canvas>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}