'use client';

import { useParams, Link } from "react-router-dom";
import { DateTime } from "luxon";
import { AreaChart, Area,  CartesianGrid,  XAxis, YAxis, Tooltip, } from "recharts";

import DeviceEvent from "../api/types/device.ts";
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

  const recordsFiltered = records
    .filter((r: SensorEvent) => r.deviceId === device.id)
    .sort((a: SensorEvent, b: SensorEvent) => a.deviceTime - b.deviceTime)

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
        <ChartRealtime device={device} />
      </div>
        
      <div className="row">
        <ChartRow title="1h" records={recordsFiltered} from={ DateTime.now().setZone("UTC") } till={ DateTime.now().minus({hour: 1}).setZone("UTC") } />
      </div>
        
      <div className="row">
        <ChartRow title="24h" records={recordsFiltered} from={ DateTime.now().setZone("UTC") } till={ DateTime.now().minus({day: 1}).setZone("UTC") } />
      </div>
    </>
  );
}

type ChartRealtimeProperties = {
  device: DeviceEvent
}

function ChartRealtime({device}: ChartRealtimeProperties) {
  return <>
      <div className="row">
        <h2>
          <strong>Realtime Usage</strong>
        </h2>
      </div>
      <div className="row font-monospace" style={{textAlign: "right"}}>
        <div className="col-md-8">
          <h1>
              <strong> {device.state.power} W </strong>
              <br/>
              <strong> {device.state.current} A </strong>
              <br/>
              <strong> {device.state.voltage} V </strong>
          </h1>
        </div>
      </div>
    </>
}

type ChartRowProperties = {
  title: string,
  records: SensorEvent[],
  from: DateTime,
  till: DateTime,
}

const updatePeriod = 15;

function ChartRow({title, records, from, till}: ChartRowProperties) { 
  const fromTimestamp = from.toUnixInteger()
  const tillTimestamp = till.toUnixInteger()

  let lastTime = tillTimestamp;

  type chartPoint = {
    axisText: string
    power: number
  }
  const sensors1h: chartPoint[] = []
  for (const record of records) {
    if (record.deviceTime > fromTimestamp) {
      console.log("Time from the future " + fromTimestamp);
      continue
    }

    if (record.deviceTime < tillTimestamp) {
      continue
    }

    const sinceLastRecord = record.deviceTime - lastTime
    if (sinceLastRecord > (updatePeriod * 10)) {
      const missedRecords = sinceLastRecord / updatePeriod;
      for (let i = 0; i < missedRecords; i++) {
          let synthRecordTime = lastTime + (i * updatePeriod);
          if (synthRecordTime < tillTimestamp) {
            continue
          }
          if (synthRecordTime > fromTimestamp) {
            continue
          }

          const date = DateTime.fromMillis(synthRecordTime * 1000)

          sensors1h.push({
              axisText: date.toFormat("HH:mm"),
              power: 0,
          })
      }
    }

    lastTime = record.deviceTime
    
    const date = DateTime.fromMillis(record.deviceTime * 1000)
    
    sensors1h.push({
        axisText: date.toFormat("HH:mm"),
        power: record.power,
      })
  }

  if (sensors1h.length == 0) {
    return <></>
  }

  return <>
          <div className="row">
            <h2>
              <strong>{title}</strong>
            </h2>
            <div className="clearfix"></div>
          </div>
          <div className="row">
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
      </>
}

/*
function ChartLast30days () {
  return <div className="row">
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
}

function MiddleRow() {
  return <div className="row">
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
}


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