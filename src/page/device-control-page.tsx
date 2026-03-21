'use client';

import { useParams} from "react-router-dom";
import DeviceEvent from "../api/types/device";
import { useState } from "react";
import HttpApi from "../api/http";

type DeviceProperties = {
  devices: DeviceEvent[];
    api: HttpApi;
};

function GetById(devices: DeviceEvent[], id: number): DeviceEvent|null {
  for (const device of devices) {
    if (device.id === id) {
      return device;
    }
  }
  return null;
}

export default function DeviceControlPage({devices, api}: DeviceProperties) {
  const [inProgress, setInProgress] = useState<boolean>(false);

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

  const togglePower = async () => {
    setInProgress(true);
    await api.control(device.id, "power", device.state.on ? "OFF" : "ON")
    setInProgress(false);
  }

    return <>
      <div className="row">
        <h2>
          <i className={"fa fa-plug " + (device.state.on ? "text-success" : "text-danger")}></i> 
          {device.name}
        </h2>
      </div>
      <div className="row">
        <div className="col-md-3">
            Power:
        </div>
        <div className="col-md-9">
            <button onClick={ togglePower } disabled={inProgress}>
                <i className={"fa " + (device.state.on ? "fa-toggle-on" : "fa-toggle-off")} style={{fontSize: 24}}></i>
            </button>
        </div>
      </div>
    </>
}