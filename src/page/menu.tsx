'use client';

import DeviceEvent from "../api/types/device";
import { MenuRow } from "./menu-row";
import {Link} from "react-router-dom";

type MenuProperties = {
  devices: DeviceEvent[];
};

export default function Menu({ devices }: MenuProperties) {
  return (
    <div className="sidebar-sticky">
        <ul className="nav flex-column"> 
            <li className="nav-item">
                <Link to={"/"} className="nav-link"> <i className={"fa-solid fa-gauge"}></i> Dashboard </Link>
            </li>
            {devices.map((device: DeviceEvent) => MenuRow(device))}
        </ul>
      </div>
  );
}