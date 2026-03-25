"use client";

import { Link } from "react-router-dom";
import { MouseEventHandler, useState } from "react";
import {Nav, Button, Offcanvas} from "react-bootstrap";

import DeviceEvent from "../api/types/device";

type MenuProperties = {
  devices: DeviceEvent[];
};

function MenuRow(device: DeviceEvent, key: string, onClick: MouseEventHandler<HTMLAnchorElement>) {
  return (
    <li key={key}>
      <Link to={"/device/" + device.id} className="nav-link" onClick={ onClick }  >
        <i className={"fa fa-plug " + (device.state.on ? "text-success" : "text-danger")}></i> 
        {device.name}
      </Link>
    </li>
  );
}

export default function Menu({ devices }: MenuProperties) {

    const [show, setShow] = useState(false);

  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  return (
    <>
    <Nav className="col-md-3 col-lg-2 d-none d-sm-none d-md-block sidebar">
      <div className="sidebar-sticky">
        <ul className="nav flex-column">
          <li className="nav-item">
            <Link to={"/"} className="nav-link">
              <i className={"fa-solid fa-gauge"}></i> Dashboard 
            </Link>
          </li>
          {Object.values(devices).map((device: DeviceEvent) => MenuRow(device, "menu-device-big-" + device.id, () => {}))}
        </ul>
      </div>
    </Nav>


      <Button variant="secondary" onClick={handleShow} className="col-2 d-block d-md-none" style={{marginLeft: 15}} >
        <i className="fa fa-bars"></i>
      </Button>

      <Offcanvas show={show} onHide={handleClose}>
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>Offcanvas</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          <Nav className="">
            <div className="sidebar-sticky">
              <ul className="nav flex-column">
                <li className="nav-item">
                  <Link to={"/"} className="nav-link" onClick={handleClose}>
                    <i className={"fa-solid fa-gauge"}></i> Dashboard 
                  </Link>
                </li>
                {Object.values((device: DeviceEvent) => MenuRow(device, "menu-device-big-" + device.id, handleClose))}            
              </ul>
            </div>
          </Nav>
        </Offcanvas.Body>
      </Offcanvas>
      </>
  );
}
