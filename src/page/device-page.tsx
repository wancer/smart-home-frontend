'use client';

import { useParams, Link } from "react-router-dom";
import DeviceEvent from "../api/types/device.ts";
import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

import SensorEvent from "../api/types/sensor.ts"

type DeviceProperties = {
  devices: DeviceEvent[];
  records: any;
};

function GetById(devices: DeviceEvent[], id: number): DeviceEvent|null {
  for (const device of devices) {
    if (device.id === id) {
      return device;
    }
  }
  return null;
}

export function DevicePage({ devices, records }: DeviceProperties) {
  const { id: idRaw } = useParams();
  if (typeof idRaw === "undefined") {
    return <></>;
  }
  if (devices.length === 0) {
    return <></>;
  }

  const id = parseInt(idRaw);
  const device = GetById(devices, id);
  if (!device) {
    return <></>
  }


  const sensors1h = records
    .filter((r: SensorEvent) => r.deviceId === device.id)
    .sort((a: SensorEvent, b: SensorEvent) => a.deviceTime - b.deviceTime)
    .slice(0, 4 * 60) // 4 data points per minute
    .map((a: SensorEvent): object => {
      const date = new Date(a.deviceTime * 1000);
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
        power: a.power,
      };
    });

  const sensors24h = records
    .filter((r: SensorEvent) => r.deviceId === device.id)
    .sort((a: SensorEvent, b: SensorEvent) => a.deviceTime - b.deviceTime)
    .slice(0, 4 * 60 * 24) // 4 data points per minute
    .map((a: SensorEvent): object => {
      const date = new Date(a.deviceTime * 1000);
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
        power: a.power,
      };
    });
    /*
  const CustomTooltip = ({ active, payload, label }: TooltipContentProps) => {
    if (payload.length > 0) {
      const data = payload[0].payload;
      return <>{data.tooltipText}</>;
    }
    return <>dsadas</>;
  };*/

  return (
    <>
      <div className="row">
        
        <h2>
          <i className={"fa fa-plug " + (device.state.on ? "text-success" : "text-danger")}></i> 
          {device.name}
          
          <Link to={"/device/" + device.id + "/control"} className=""> 
            <i className={"fa fa-cog text-primary"}></i> 
          </Link>
        </h2>
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
                  <strong id="rtu-power">{device.state.power} W</strong>
                </h1>
              </div>
              <div className="row">
                <div className="col-md-6 col-xs-6 text-center">
                  <h1>
                  <strong id="rtu-power">{device.state.current} A</strong>
                  </h1>
                </div>
                <div className="col-md-6 col-xs-6 text-center">
                  <h1>
                  <strong id="rtu-power">{device.state.voltage} V</strong>
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
                data={sensors1h}
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
                <Tooltip contentStyle={{color:"black"}} />
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
                data={sensors24h}
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
                <Tooltip contentStyle={{color:"black"}} />
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

        
        <footer>
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
    </>
  );
}