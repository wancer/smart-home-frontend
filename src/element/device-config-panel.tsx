import { useState, useEffect } from "react";
import { Row, Col, Button, ButtonGroup, Form, Modal } from "react-bootstrap";
import HttpApi from "../api/http";
import DeviceEvent from "../api/types/device";
import timezones from '../page/timezones';

type Props = {
  api: HttpApi;
  device: DeviceEvent;
};

type Section = "power" | "general" | "led" | "calibration" | "hardware" | null;

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

function SaveBtn({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <Button variant="success" size="sm" disabled={disabled} onClick={onClick}>
      <i className="fa fa-floppy-disk"></i>
    </Button>
  );
}

export default function DeviceConfigPanel({ api, device }: Props) {
  const [inProgress, setInProgress] = useState(false);
  const [openSection, setOpenSection] = useState<Section>(null);

  const [sensorsFreq, setSensorsFreq] = useState(-1);
  const [timezone, setTimezone] = useState("");

  const [voltageState, setVoltageState] = useState(-1);
  const [powerState, setPowerState] = useState(-1);

  const [ledPower, setLedPower] = useState(false);
  const [ledMode, setLedMode] = useState(-1);
  const [ledPwmMode, setLedPwmMode] = useState(false);
  const [ledPwmOn, setLedPwmOn] = useState(-1);
  const [ledPwmOff, setLedPwmOff] = useState(-1);

  const [firmwareVersion, setFirmwareVersion] = useState("");
  const [firmwareBuiltAt, setFirmwareBuiltAt] = useState("");
  const [hardwareChip, setHardwareChip] = useState<string | null>(null);

  const loadConfig = () => {
    api.getConfig(device.id).then((config) => {
      setSensorsFreq(config.telePeriod);
      setTimezone(config.timezone);
      setLedPower(config.led.ledPower);
      setLedMode(config.led.ledState);
      setLedPwmMode(config.led.ledPwmMode);
      setLedPwmOn(config.led.ledPwmOn);
      setLedPwmOff(config.led.ledPwmOff);
      setFirmwareVersion(config.firmware.version);
      setFirmwareBuiltAt(config.firmware.buildAt);
      setHardwareChip(config.hardware);
    });
  };

  useEffect(() => {
    setVoltageState(device.state.voltage);
    setPowerState(device.state.power);
    loadConfig();
  }, [device]);

  const run = async (action: () => Promise<void>) => {
    setInProgress(true);
    await action();
    await delay(1000);
    loadConfig();
    setInProgress(false);
  };

  const switchOnOff = () =>
    run(() => api.control(device.id, "on-off", device.state.on ? "OFF" : "ON"));

  const sectionTitles: Record<Exclude<Section, null>, string> = {
    power: "Power",
    general: "General",
    led: "LED",
    calibration: "Calibration",
    hardware: "Hardware",
  };

  return (
    <>
      <ButtonGroup size="sm">
        {device.supportsToggle && (
          <Button variant="outline-secondary" title="Power" onClick={() => setOpenSection("power")}>
            <i className="fa fa-power-off"></i>
          </Button>
        )}
        <Button variant="outline-secondary" title="General" onClick={() => setOpenSection("general")}>
          <i className="fa fa-clock"></i>
        </Button>
        <Button variant="outline-secondary" title="LED" onClick={() => setOpenSection("led")}>
          <i className="fa fa-lightbulb"></i>
        </Button>
        <Button variant="outline-secondary" title="Calibration" onClick={() => setOpenSection("calibration")}>
          <i className="fa fa-gauge"></i>
        </Button>
        <Button variant="outline-secondary" title="Hardware" onClick={() => setOpenSection("hardware")}>
          <i className="fa fa-microchip"></i>
        </Button>
      </ButtonGroup>

      <Modal show={openSection !== null} onHide={() => setOpenSection(null)}>
        <Modal.Header closeButton>
          <Modal.Title>{openSection ? sectionTitles[openSection] : ""}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {openSection === "power" && (
            <Row className="align-items-center">
              <Col xs="auto">On:</Col>
              <Col xs="auto">
                <button onClick={switchOnOff} disabled={inProgress} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                  <i
                    className={"fa " + (device.state.on ? "fa-toggle-on text-success" : "fa-toggle-off text-danger")}
                    style={{ fontSize: 32 }}
                  ></i>
                </button>
              </Col>
            </Row>
          )}
          {openSection === "general" && (
            <>
              <Form.Group as={Row} className="mb-3 align-items-center" controlId="cfgTimezone">
                <Form.Label column sm="3">Timezone</Form.Label>
                <Col sm="7">
                  <Form.Select value={timezone} onChange={e => setTimezone(e.target.value)}>
                    {timezones.map(tz => <option key={"tz-" + tz} value={tz}>{tz}</option>)}
                  </Form.Select>
                </Col>
                <Col sm="2">
                  <SaveBtn disabled={inProgress} onClick={() => run(() => api.control(device.id, "timezone", timezone))}/>
                </Col>
              </Form.Group>
              <Form.Group as={Row} className="mb-3 align-items-center" controlId="cfgSensorsFreq">
                <Form.Label column sm="3">Sensors freq</Form.Label>
                <Col sm="7">
                  <Form.Control value={sensorsFreq} onChange={e => setSensorsFreq(+e.target.value)}/>
                </Col>
                <Col sm="2">
                  <SaveBtn disabled={inProgress} onClick={() => run(() => api.control(device.id, "tele-period", sensorsFreq.toString()))}/>
                </Col>
              </Form.Group>
            </>
          )}
          {openSection === "led" && (
            <>
              <Form.Group as={Row} className="mb-3 align-items-center" controlId="cfgLedOnOff">
                <Form.Label column sm="3">LED on/off</Form.Label>
                <Col sm="7">
                  <Form.Check type="switch" label="switch" value={1} checked={ledPower} onChange={() => setLedPower(!ledPower)}/>
                </Col>
                <Col sm="2">
                  <SaveBtn disabled={inProgress} onClick={() => run(() => api.control(device.id, "led-power", ledPower ? "ON" : "OFF"))}/>
                </Col>
              </Form.Group>
              <Form.Group as={Row} className="mb-3 align-items-center" controlId="cfgLedMode">
                <Form.Label column sm="3">LED mode</Form.Label>
                <Col sm="7">
                  <Form.Select value={ledMode} onChange={e => setLedMode(+e.target.value)}>
                    <option value={0}>disable use of LED as much as possible</option>
                    <option value={1}>show power state on LED (LED on when power on) (default)</option>
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
                  <SaveBtn disabled={inProgress} onClick={() => run(() => api.control(device.id, "led-mode", ledMode.toString()))}/>
                </Col>
              </Form.Group>
              <Form.Group as={Row} className="mb-3 align-items-center" controlId="cfgPwmMode">
                <Form.Label column sm="3">PWM LED on/off</Form.Label>
                <Col sm="7">
                  <Form.Check type="switch" label="switch" value={1} checked={ledPwmMode} onChange={() => setLedPwmMode(!ledPwmMode)}/>
                </Col>
                <Col sm="2">
                  <SaveBtn disabled={inProgress} onClick={() => run(() => api.control(device.id, "led-pwm-mode", ledPwmMode ? "ON" : "OFF"))}/>
                </Col>
              </Form.Group>
              <Form.Group as={Row} className="mb-3 align-items-center" controlId="cfgLedPwmOn">
                <Form.Label column sm="3">PWM intens ON</Form.Label>
                <Col sm="7">
                  <Form.Control type="range" value={ledPwmOn} onChange={e => setLedPwmOn(+e.target.value)} min={0} max={255}/>
                </Col>
                <Col sm="2">
                  <SaveBtn disabled={inProgress} onClick={() => run(() => api.control(device.id, "led-pwm-on", ledPwmOn.toString()))}/>
                </Col>
              </Form.Group>
              <Form.Group as={Row} className="mb-3 align-items-center" controlId="cfgLedPwmOff">
                <Form.Label column sm="3">PWM intens OFF</Form.Label>
                <Col sm="7">
                  <Form.Control type="range" value={ledPwmOff} onChange={e => setLedPwmOff(+e.target.value)} min={0} max={255}/>
                </Col>
                <Col sm="2">
                  <SaveBtn disabled={inProgress} onClick={() => run(() => api.control(device.id, "led-pwm-off", ledPwmOff.toString()))}/>
                </Col>
              </Form.Group>
            </>
          )}
          {openSection === "calibration" && (
            <>
              <Form.Group as={Row} className="mb-3 align-items-center" controlId="cfgVoltage">
                <Form.Label column sm="3">Voltage</Form.Label>
                <Col sm="7">
                  <Form.Control type="number" value={voltageState} onChange={e => setVoltageState(+e.target.value)}/>
                </Col>
                <Col sm="2">
                  <SaveBtn disabled={inProgress} onClick={() => run(() => api.control(device.id, "voltage", voltageState.toString()))}/>
                </Col>
              </Form.Group>
              <Form.Group as={Row} className="mb-3 align-items-center" controlId="cfgPower">
                <Form.Label column sm="3">Power</Form.Label>
                <Col sm="7">
                  <Form.Control type="number" value={powerState} onChange={e => setPowerState(+e.target.value)}/>
                </Col>
                <Col sm="2">
                  <SaveBtn disabled={inProgress} onClick={() => run(() => api.control(device.id, "power", powerState.toString()))}/>
                </Col>
              </Form.Group>
            </>
          )}
          {openSection === "hardware" && (
            <Form>
              {hardwareChip && (
                <Form.Group as={Row} className="mb-3" controlId="cfgChip">
                  <Form.Label column sm="3">Chip</Form.Label>
                  <Col sm="9" className="d-flex align-items-center">
                    <i className="fa fa-microchip me-2 text-secondary"></i>{hardwareChip}
                  </Col>
                </Form.Group>
              )}
              <Form.Group as={Row} className="mb-3" controlId="cfgFwVersion">
                <Form.Label column sm="3">Version</Form.Label>
                <Col sm="9" className="d-flex align-items-center">{firmwareVersion}</Col>
              </Form.Group>
              <Form.Group as={Row} className="mb-3" controlId="cfgFwBuiltAt">
                <Form.Label column sm="3">Build At</Form.Label>
                <Col sm="9" className="d-flex align-items-center">{firmwareBuiltAt}</Col>
              </Form.Group>
            </Form>
          )}
        </Modal.Body>
      </Modal>
    </>
  );
}
