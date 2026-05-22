"use client";

import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import DeviceEvent from "../api/types/device";
import PowerIcon from "../element/power-icon";

type DashboardProperties = {
  devices: DeviceEvent[];
};

function DeviceBlock({ device }: { device: DeviceEvent }) {
  const { t } = useTranslation();
  return (
    <div className="col-md-6 col-sm-6 col-xs-12">
      <div className="row">
        <h2>
          <Link to={"/device/" + device.id} className="text-decoration-none text-reset">
            <PowerIcon device={device} />
            <strong>{device.name}</strong>
          </Link>
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
          { device.state.last > 0 && (
            <small className="text-muted">
              {t('dashboard.updated')} {new Date(device.state.last * 1000).toLocaleTimeString()}
            </small>
          )}
        </div>
      </div>
    </div>
  );
}

export function DashboardPage({ devices }: DashboardProperties) {
  return (
    <>
      <div className="row">
        {Object.values(devices).filter((d) => d.enabled).map((device: DeviceEvent) => (
          <DeviceBlock key={"dashboard-block-" + device.id} device={device} />
        ))}
      </div>
    </>
  );
}
 