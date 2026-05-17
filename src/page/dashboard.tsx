"use client";

import DeviceEvent from "../api/types/device";
import PowerIcon from "../element/power-icon";

type DashboardProperties = {
  devices: DeviceEvent[];
};

function DeviceBlock(device: DeviceEvent) {
  return (
    <div className="col-md-6 col-sm-6 col-xs-12" key={"dashboard-block-" + device.id}>
      <div className="row">
        <h2>
          <PowerIcon device={device} />
          <strong>{device.name}</strong>
        </h2>
      </div>
      <div className="row font-monospace" style={{textAlign: "right"}}>
        <div className="col-md-8">
          { device.isEnergySensor() && (<h1>
              <strong> {device.state.power} W </strong>
              <br/>
              <strong> {device.state.current} A </strong>
              <br/>
              <strong> {device.state.voltage} V </strong>
          </h1>) 
          }

          { device.isCo2Sensor() && (<h1>
              <strong> {device.state.temperature} ° </strong>
              <br/>
              <strong> {device.state.humidity} % </strong>
              <br/>
              <strong> {device.state.co2e} * </strong>
          </h1>) 
          }

          { device.isThSensor() && (<h1>
              <strong> {device.state.temperature} ° </strong>
              <br/>
              <strong> {device.state.humidity} % </strong>
              <br/>
          </h1>) 
          }
          
        </div>
      </div>
    </div>
  );
}

export function DashboardPage({ devices }: DashboardProperties) {
  return (
    <>
      <div className="row">
        {Object.values(devices).map((device: DeviceEvent) => DeviceBlock(device))}
      </div>
    </>
  );
}
 