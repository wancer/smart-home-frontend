import {Link} from "react-router-dom";
import Device from "../device.ts";

export function MenuRow(device: Device) {
  return (
    <li>
      <Link to={"/device/" + device.id}>
        <i className="fa fa-plug"></i> {device.name}
      </Link>
    </li>
  );
}