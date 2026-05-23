import { useState, useEffect } from "react";
import { Row, Col, Button, ButtonGroup, Form, Modal } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import HttpApi from "../api/http";
import DeviceEvent from "../api/types/device";
import timezones from '../page/timezones';

type Props = {
  api: HttpApi;
  device: DeviceEvent;
};

type Section = "power" | "timing" | "led" | "calibration" | "hardware" | null;

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

function advanceDeviceTime(base: string, elapsedMs: number): string {
  const timePart = base.slice(11); // "HH:MM:SS"
  const [h, m, s] = timePart.split(":").map(Number);
  const total = h * 3600 + m * 60 + s + Math.floor(elapsedMs / 1000);
  const ss = total % 60;
  const mm = Math.floor(total / 60) % 60;
  const hh = Math.floor(total / 3600) % 24;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${base.slice(0, 11)}${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}

function SaveBtn({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <Button variant="success" size="sm" disabled={disabled} onClick={onClick}>
      <i className="fa fa-floppy-disk"></i>
    </Button>
  );
}

export default function DeviceConfigPanel({ api, device }: Props) {
  const { t } = useTranslation();
  const [inProgress, setInProgress] = useState(false);
  const [openSection, setOpenSection] = useState<Section>(null);
  const [deviceTime, setDeviceTime] = useState("");

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

  useEffect(() => {
    if (openSection !== "timing") return;
    const base = device.state.deviceTime;
    const at = device.state.last * 1000;
    const tick = () => setDeviceTime(advanceDeviceTime(base, Date.now() - at));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [openSection, device.state.deviceTime, device.state.last]);

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
    power: t('configPanel.section_power'),
    timing: t('configPanel.section_timing'),
    led: t('configPanel.section_led'),
    calibration: t('configPanel.section_calibration'),
    hardware: t('configPanel.section_hardware'),
  };

  return (
    <>
      <ButtonGroup size="sm">
        {device.supportsToggle && (
          <Button variant="outline-secondary" title={t('configPanel.section_power')} onClick={() => setOpenSection("power")}>
            <i className="fa fa-power-off"></i>
          </Button>
        )}
        <Button variant="outline-secondary" title={t('configPanel.section_timing')} onClick={() => setOpenSection("timing")}>
          <i className="fa fa-clock"></i>
        </Button>
        <Button variant="outline-secondary" title={t('configPanel.section_led')} onClick={() => setOpenSection("led")}>
          <i className="fa fa-lightbulb"></i>
        </Button>
        <Button variant="outline-secondary" title={t('configPanel.section_calibration')} onClick={() => setOpenSection("calibration")}>
          <i className="fa fa-gauge"></i>
        </Button>
        <Button variant="outline-secondary" title={t('configPanel.section_hardware')} onClick={() => setOpenSection("hardware")}>
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
              <Col xs="auto">{t('configPanel.on')}</Col>
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
          {openSection === "timing" && (
            <>
              {deviceTime && (
                <div className="mb-3 font-monospace text-center" style={{ fontSize: "2rem" }}>
                  {deviceTime}
                </div>
              )}
              <Form.Group as={Row} className="mb-3 align-items-center" controlId="cfgTimezone">
                <Form.Label column sm="3">{t('configPanel.timezone')}</Form.Label>
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
                <Form.Label column sm="3">{t('configPanel.sensorsFreq')}</Form.Label>
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
                <Form.Label column sm="3">{t('configPanel.ledOnOff')}</Form.Label>
                <Col sm="7">
                  <Form.Check type="switch" label="switch" value={1} checked={ledPower} onChange={() => setLedPower(!ledPower)}/>
                </Col>
                <Col sm="2">
                  <SaveBtn disabled={inProgress} onClick={() => run(() => api.control(device.id, "led-power", ledPower ? "ON" : "OFF"))}/>
                </Col>
              </Form.Group>
              <Form.Group as={Row} className="mb-3 align-items-center" controlId="cfgLedMode">
                <Form.Label column sm="3">{t('configPanel.ledMode')}</Form.Label>
                <Col sm="7">
                  <Form.Select value={ledMode} onChange={e => setLedMode(+e.target.value)}>
                    {([0,1,2,3,4,5,6,7,8] as const).map(n => (
                      <option key={n} value={n}>{t(`configPanel.ledMode_${n}`)}</option>
                    ))}
                  </Form.Select>
                </Col>
                <Col sm="2">
                  <SaveBtn disabled={inProgress} onClick={() => run(() => api.control(device.id, "led-mode", ledMode.toString()))}/>
                </Col>
              </Form.Group>
              <Form.Group as={Row} className="mb-3 align-items-center" controlId="cfgPwmMode">
                <Form.Label column sm="3">{t('configPanel.pwmLedOnOff')}</Form.Label>
                <Col sm="7">
                  <Form.Check type="switch" label="switch" value={1} checked={ledPwmMode} onChange={() => setLedPwmMode(!ledPwmMode)}/>
                </Col>
                <Col sm="2">
                  <SaveBtn disabled={inProgress} onClick={() => run(() => api.control(device.id, "led-pwm-mode", ledPwmMode ? "ON" : "OFF"))}/>
                </Col>
              </Form.Group>
              <Form.Group as={Row} className="mb-3 align-items-center" controlId="cfgLedPwmOn">
                <Form.Label column sm="3">{t('configPanel.pwmIntensOn')}</Form.Label>
                <Col sm="7">
                  <Form.Control type="range" value={ledPwmOn} onChange={e => setLedPwmOn(+e.target.value)} min={0} max={255}/>
                </Col>
                <Col sm="2">
                  <SaveBtn disabled={inProgress} onClick={() => run(() => api.control(device.id, "led-pwm-on", ledPwmOn.toString()))}/>
                </Col>
              </Form.Group>
              <Form.Group as={Row} className="mb-3 align-items-center" controlId="cfgLedPwmOff">
                <Form.Label column sm="3">{t('configPanel.pwmIntensOff')}</Form.Label>
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
                <Form.Label column sm="3">{t('configPanel.voltage')}</Form.Label>
                <Col sm="7">
                  <Form.Control type="number" value={voltageState} onChange={e => setVoltageState(+e.target.value)}/>
                </Col>
                <Col sm="2">
                  <SaveBtn disabled={inProgress} onClick={() => run(() => api.control(device.id, "voltage", voltageState.toString()))}/>
                </Col>
              </Form.Group>
              <Form.Group as={Row} className="mb-3 align-items-center" controlId="cfgPower">
                <Form.Label column sm="3">{t('configPanel.power')}</Form.Label>
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
                  <Form.Label column sm="3">{t('configPanel.chip')}</Form.Label>
                  <Col sm="9" className="d-flex align-items-center">
                    <i className="fa fa-microchip me-2 text-secondary"></i>{hardwareChip}
                  </Col>
                </Form.Group>
              )}
              <Form.Group as={Row} className="mb-3" controlId="cfgFwVersion">
                <Form.Label column sm="3">{t('configPanel.version')}</Form.Label>
                <Col sm="9" className="d-flex align-items-center">{firmwareVersion}</Col>
              </Form.Group>
              <Form.Group as={Row} className="mb-3" controlId="cfgFwBuiltAt">
                <Form.Label column sm="3">{t('configPanel.buildAt')}</Form.Label>
                <Col sm="9" className="d-flex align-items-center">{firmwareBuiltAt}</Col>
              </Form.Group>
            </Form>
          )}
        </Modal.Body>
      </Modal>
    </>
  );
}
