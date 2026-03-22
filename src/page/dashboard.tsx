"use client";

import DeviceEvent from "../api/types/device";

type DashboardProperties = {
  devices: DeviceEvent[];
};

function DeviceBlock(
  device: DeviceEvent,
) {
  return (
    <div className="col-md-6 col-sm-6 col-xs-12">
      <div className="row">
        <h2>
          <i className={"fa fa-plug " + (device.state.on ? "text-success" : "text-danger")}></i> 
          <strong>{device.name}</strong>
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
    </div>
  );
}

export function DashboardPage({ devices }: DashboardProperties) {
  return (
    <>
      <div className="row">
        {devices.map((device: DeviceEvent) => DeviceBlock(device))}
      </div>
    </>
  );
}
 