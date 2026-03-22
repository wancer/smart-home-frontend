"use client";

import { useParams } from "react-router-dom";
import DeviceEvent from "../api/types/device";
import { useState } from "react";
import HttpApi from "../api/http";

type DeviceProperties = {
  devices: DeviceEvent[];
  api: HttpApi;
};

function GetById(devices: DeviceEvent[], id: number): DeviceEvent | null {
  for (const device of devices) {
    if (device.id === id) {
      return device;
    }
  }
  return null;
}

export default function DeviceControlPage({ devices, api }: DeviceProperties) {
  const [inProgress, setInProgress] = useState<boolean>(false);
  const [voltageState, setVoltageState] = useState<number>( NaN );

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
    return <></>;
  }

  const togglePower = async () => {
    setInProgress(true);
    await api.control(device.id, "power", device.state.on ? "OFF" : "ON");
    setInProgress(false);
  };

  const setVoltage = async () => {
    setInProgress(true);
    await api.control(device.id, "voltage", voltageState.toString());
    setInProgress(false);
  };

  if (Number.isNaN(voltageState)) { // initial value
    setVoltageState(device.state.voltage)
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
        </h2>
      </div>
      <div className="row">
        <div className="col-md-3">Power:</div>
        <div className="col-md-9">
          <button onClick={togglePower} disabled={inProgress}>
            <i
              className={
                "fa " + (device.state.on ? "fa-toggle-on" : "fa-toggle-off")
              }
              style={{ fontSize: 24 }}
            ></i>
          </button>
        </div>
      </div>
      <div className="row">
        <div className="col-md-3">Voltage:</div>
        <div className="col-md-9">
            <input type="number" value={ voltageState } onChange={e => setVoltageState(+e.target.value)} />
            <button disabled={inProgress} onClick={ setVoltage }>Save</button>
        </div>
      </div>
    </>
  );
}
