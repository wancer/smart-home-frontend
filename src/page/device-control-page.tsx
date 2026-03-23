"use client";

import { useParams } from "react-router-dom";
import { useState } from "react";
import {Row, Col} from "react-bootstrap";

import DeviceEvent from "../api/types/device";
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
  const [powerState, setPowerState] = useState<number>( NaN );

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

  const switchOnOff = async () => {
    setInProgress(true);
    await api.control(device.id, "on-off", device.state.on ? "OFF" : "ON");
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

  const setPower = async () => {
    setInProgress(true);
    await api.control(device.id, "power", powerState.toString());
    setInProgress(false);
  };
  if (Number.isNaN(powerState)) { // initial value
    setPowerState(device.state.power)
  }

  return (
    <>
      <Row>
        <h2>
          <i className={"fa fa-plug " + (device.state.on ? "text-success" : "text-danger")}></i>
          {device.name}
        </h2>
      </Row>
      <section>
      <Row>
        <Col xs={10} sm={6} md={3}>Power:</Col>
        <Col xs={2} sm={6} md={3}>
          <button onClick={switchOnOff} disabled={inProgress}>
            <i
              className={
                "fa " + (device.state.on ? "fa-toggle-on" : "fa-toggle-off")
              }
              style={{ fontSize: 24 }}
            ></i>
          </button>
        </Col>
      </Row>
      </section>
      <hr/>
      <section style={{marginBottom: 20}}>
        <h2>
          Calibration
        </h2>
        <Row style={{marginBottom: 15}}>
          <Col xs={10} sm={6} md={3}>Voltage:</Col>
          <Col xs={2} sm={6} md={3}>
              <input type="number" value={ voltageState } onChange={e => setVoltageState(+e.target.value)} style={{maxWidth: 70}} />
              <button disabled={inProgress} onClick={ setVoltage }>Save</button>
          </Col>
        </Row>
        <Row>
          <Col xs={10} sm={6} md={3}>Power:</Col>
          <Col xs={2} sm={6} md={3}>
              <input type="number" value={ powerState } onChange={e => setPowerState(+e.target.value)} style={{maxWidth: 70}} />
              <button disabled={inProgress} onClick={ setPower }>Save</button>
          </Col>
        </Row>
      </section>
    </>
  );
}
