"use client";

import { Link } from "react-router-dom";
import { useState } from "react";
import {Nav, Button, Offcanvas} from "react-bootstrap";

import DeviceEvent from "../api/types/device";
import { MenuRow } from "./menu-row";

type MenuProperties = {
  devices: DeviceEvent[];
};

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
          {devices.map((device: DeviceEvent) => MenuRow(device, "menu-device-big-" + device.id))}
        </ul>
      </div>
    </Nav>


      <Button variant="secondary" onClick={handleShow} className="col-1 d-block d-md-none  " style={{marginLeft: 15}} >
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
                  <Link to={"/"} className="nav-link">
                    <i className={"fa-solid fa-gauge"}></i> Dashboard 
                  </Link>
                </li>
                {devices.map((device: DeviceEvent) => MenuRow(device, "menu-device-small-" + device.id))}
              </ul>
            </div>
          </Nav>
        </Offcanvas.Body>
      </Offcanvas>
      </>
  );
}
