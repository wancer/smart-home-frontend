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
      <div className="x_panel tile">
        <div className="x_title">
          <h2>
            <i className={"fa fa-plug " + (device.state.on ? "text-success" : "text-danger")}></i> 
            <strong>{device.name}</strong>
          </h2>
          <div className="clearfix"></div>
        </div>
        <div className="x_content">
          <div className="row">
            <h1 className="text-center">
              <strong id="rtu-power">
                {device.state.power} W
              </strong>
            </h1>
          </div>
          <div className="row">
            <div className="col-md-6 col-xs-6 text-center">
              <h1>
                <strong id="rtu-power">
                  {device.state.current} A
                </strong>
              </h1>
            </div>
            <div className="col-md-6 col-xs-6 text-center">
              <h1>
                <strong id="rtu-power">
                  {device.state.voltage} V
                </strong>
              </h1>
            </div>
          </div>
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
 