"use client";

import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import {Row, Col, Button, Collapse, Form} from "react-bootstrap";

import DeviceEvent from "../api/types/device";
import HttpApi from "../api/http";
import timezones from './timezones';
import PowerIcon from "../element/power-icon";

type DeviceControlPageProperties = {
  api: HttpApi;
  devices: DeviceEvent[];
};

export default function DeviceControlPage({ api, devices }: DeviceControlPageProperties) {
  const { idStr } = useParams();
  const deviceId = typeof idStr === "undefined" ? 0 : +idStr;
  const device = devices[deviceId];
  
  const [inProgress, setInProgress] = useState<boolean>(false);
  const [configVisible, showConfig] = useState<boolean>(false);

  const [voltageState, setVoltageState] = useState<number>( -1 );
  const [powerState, setPowerState] = useState<number>( -1 );
  const [sensorsFreq, setSensorsFreq] = useState<number>( -1 );
  const [ledPower, setLedPower] = useState<boolean>( false );
  const [ledMode, setLedMode] = useState<number>( -1 );
  const [timezone, setTimezone] = useState<string>( "" );
  const [ledPwmMode, setLedPwmMode] = useState<boolean>( false );
  const [ledPwmOn, setLedPwmOn] = useState<number>( -1 );
  const [ledPwmOff, setLedPwmOff] = useState<number>( -1 );

  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
  
  const updateConfigState = () => {
    api.getConfig(deviceId).then((config) => {
        setSensorsFreq(config.telePeriod);
        setLedPower(config.ledPower);
        setLedMode(config.ledState);
        setTimezone(config.timezone);
        setLedPwmMode(config.ledPwmMode);
        setLedPwmOn(config.ledPwmOn);
        setLedPwmOff(config.ledPwmOff);
      })
  }

  useEffect(
    () => {
      setVoltageState(device.state.voltage)
      setPowerState(device.state.power)
      updateConfigState();
    },
    [device]
  )

  const switchOnOff = async () => {
    setInProgress(true);
    await api.control(device.id, "on-off", device.state.on ? "OFF" : "ON");
    await delay(1 * 1000); // waiting for WS event after BE logic
    setVoltageState(device.state.voltage);
    setPowerState(device.state.power);
    setInProgress(false);
  };

  const setVoltage = async () => {
    setInProgress(true);
    await api.control(device.id, "voltage", voltageState.toString());
    await delay(1 * 1000); // waiting for WS event after BE logic
    setVoltageState(device.state.voltage);
    setInProgress(false);
  };

  const setPower = async () => {
    setInProgress(true);
    await api.control(device.id, "power", powerState.toString());
    await delay(1 * 1000); // waiting for WS event after BE logic
    setPowerState(device.state.power);
    setInProgress(false);
  };

  const saveLedPwmMode = async () => {
    setInProgress(true);
    await api.control(device.id, "led-pwm-mode", ledPwmMode ? "ON" : "OFF");
    await delay(1 * 1000); // waiting for WS event after BE logic
    updateConfigState();
    setInProgress(false);
  };

  const saveLedPwmOn = async () => {
    setInProgress(true);
    await api.control(device.id, "led-pwm-on", ledPwmOn.toString());
    await delay(1 * 1000); // waiting for WS event after BE logic
    updateConfigState();
    setInProgress(false);
  };

  const saveLedPwmOff = async () => {
    setInProgress(true);
    await api.control(device.id, "led-pwm-off", ledPwmOff.toString());
    await delay(1 * 1000); // waiting for WS event after BE logic
    updateConfigState();
    setInProgress(false);
  };

  return (
    <>
      <Row>
        <h2>
          <PowerIcon device={device}/>
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
      <Button onClick={() => showConfig(!configVisible)} aria-controls="example-collapse-text" variant="secondary" className={ !configVisible ? "" : "d-none" } > 
        Configuration 
      </Button>
      <Collapse in={configVisible}>
        <section>
          <hr/>
          <h2>
            General
          </h2>

          <Form>
            <Form.Group as={Row} className="mb-3" controlId="formLedMode">
              <Form.Label column sm="2">Timezone</Form.Label>
              <Col sm="8">
                <Form.Select value={timezone} onChange={e => setTimezone(e.target.value)}>
                  {timezones.map((timezone) => <option key={"tz-" + timezone} value={timezone}>{timezone}</option> )}
                </Form.Select>
              </Col>
              <Col sm="2">
                <Button variant="success" type="button">Save</Button>
              </Col>
            </Form.Group>
          </Form>


          <Form>
            <Form.Group as={Row} className="mb-3" controlId="formSensorsFre">
              <Form.Label column sm="2">Sensors freq</Form.Label>
              <Col sm="8">
              <Form.Control value={sensorsFreq} onChange={e => setSensorsFreq(+e.target.value)}/>
              </Col>
              <Col sm="2">
                <Button variant="success" type="button">Save</Button>
              </Col>
            </Form.Group>
          </Form>


          <h2>
            LED
          </h2>

          <Form>
            <Form.Group as={Row} className="mb-3" controlId="formLedOnOff">
              <Form.Label column sm="2">LED on/off</Form.Label>
              <Col sm="8">
                <Form.Check type="switch" label="switch" value={1} checked={ledPower} onChange={() => setLedPower(!ledPower) }/>
              </Col>
              <Col sm="2">
                <Button variant="success" type="button">Save</Button>
              </Col>
            </Form.Group>
          </Form>

          <Form>
            <Form.Group as={Row} className="mb-3" controlId="formLedMode">
              <Form.Label column sm="2">LED mode</Form.Label>
              <Col sm="8">
                <Form.Select aria-label="Default select example" value={ledMode} onChange={e => setLedMode(+e.target.value)}>
                  <option value={0}>disable use of LED as much as possible</option>
                  <option value={1}>show power state on LED (LED on when power on) (default) (inverted for Sonoff Touch/T1)</option>
                  <option value={2}>show MQTT subscriptions as a LED blink</option>
                  <option value={3}>show power state and MQTT subscriptions as a LED blink</option>
                  <option value={4}>show MQTT publications as a LED blink</option>
                  <option value={5}>show power state and MQTT publications as a LED blink</option>
                  <option value={6}>show all MQTT messages as a LED blink</option>
                  <option value={7}>show power state and MQTT messages as a LED blink</option>
                  <option value={8}>LED on when Wi-Fi and MQTT are connected.</option>
                </Form.Select>
              </Col>
              <Col sm="2">
                <Button variant="success" type="button">Save</Button>
              </Col>
            </Form.Group>
          </Form>


          <Form>
            <Form.Group as={Row} className="mb-3" controlId="formLedOnOff">
              <Form.Label column sm="2">PWM LED on/off</Form.Label>
              <Col sm="8">
                <Form.Check type="switch" label="switch" value={1} checked={ledPwmMode} onChange={() => setLedPwmMode(!ledPwmMode) }/>
              </Col>
              <Col sm="2">
                <Button variant="success" type="button" onClick={saveLedPwmMode}>Save</Button>
              </Col>
            </Form.Group>
          </Form>

          <Form>
            <Form.Group as={Row} className="mb-3" controlId="formLedLight">
              <Form.Label column sm="2">PWM LED intens ON</Form.Label>
              <Col sm="8">
                <Form.Control type="range" value={ledPwmOn} onChange={e => setLedPwmOn(+e.target.value) } min={0} max={255} />
              </Col>
              <Col sm="2">
                <Button variant="success" type="button" onClick={saveLedPwmOn}>Save</Button>
              </Col>
            </Form.Group>
          </Form>

          <Form>
            <Form.Group as={Row} className="mb-3" controlId="formLedLight">
              <Form.Label column sm="2">PWM LED intens OFF</Form.Label>
              <Col sm="8">
                <Form.Control type="range" value={ledPwmOff} onChange={e => setLedPwmOff(+e.target.value) } min={0} max={255} />
              </Col>
              <Col sm="2">
                <Button variant="success" type="button" onClick={saveLedPwmOff}>Save</Button>
              </Col>
            </Form.Group>
          </Form>

          <hr/>

          <h2>
            Calibration
          </h2>

          <Form>
            <Form.Group as={Row} className="mb-3" controlId="formLedMode">
              <Form.Label column sm="2">Voltage</Form.Label>
              <Col sm="8">
                <Form.Control type="number" value={voltageState} onChange={e => setVoltageState(+e.target.value)}/>
              </Col>
              <Col sm="2">
                <Button variant="success" type="button" disabled={inProgress} onClick={setVoltage}>Save</Button>
              </Col>
            </Form.Group>
          </Form>

          <Form>
            <Form.Group as={Row} className="mb-3" controlId="formLedMode">
              <Form.Label column sm="2">Power</Form.Label>
              <Col sm="8">
                <Form.Control type="number" value={powerState} onChange={e => setPowerState(+e.target.value)}/>
              </Col>
              <Col sm="2">
                <Button variant="success" type="button" disabled={inProgress} onClick={setPower}>Save</Button>
              </Col>
            </Form.Group>
          </Form>
          
        </section>
      </Collapse>
    </>
  );
}
