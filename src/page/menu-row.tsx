'use client';

import {Link} from "react-router-dom";
import DeviceEvent from "../api/types/device.ts";

export function MenuRow(device: DeviceEvent) {
  return (
    <li>
      <Link to={"/device/" + device.id} className="nav-link">
        <i className={"fa fa-plug " + (device.state.on ? "text-success" : "text-danger")}></i> 
        {device.name}
      </Link>
    </li>
  );
}