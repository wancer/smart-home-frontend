import { useState, useEffect } from "react";
import { Row, Col, Button, ButtonGroup, Dropdown, Form, Modal, Accordion } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import HttpApi from "../api/http";
import DeviceEvent from "../api/types/device";
import Timer from "../api/types/timer";
import Rule from "../api/types/rule";
import timezones from '../page/timezones';
import NotificationRules from "./notification-rules";
import { formatElapsed } from "../format";

type Props = {
  api: HttpApi;
  device: DeviceEvent;
  /** Chip temperature chart toggle (shown only for devices reporting the ESP32 temperature). */
  chipChartOpen?: boolean;
  onToggleChipChart?: () => void;
};

type Section = "power" | "timing" | "led" | "calibration" | "hardware" | "timers" | "rules" | "notifications" | null;

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

/** Runs `load` each time `section` becomes the open one; true while it's running. Errors just end the loading. */
function useSectionLoad(openSection: Section, section: Exclude<Section, null>, load: () => Promise<void>): boolean {
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (openSection !== section) return;
    setLoading(true);
    load().catch(() => {}).finally(() => setLoading(false));
  }, [openSection]);
  return loading;
}

export default function DeviceConfigPanel({ api, device, chipChartOpen = false, onToggleChipChart }: Props) {
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
  // from the stored template when known, so the LED popup shows the right sections right away
  const templateKnown = device.profile.template != null;
  const [statusLed, setStatusLed] = useState(templateKnown ? device.profile.features.statusLed : true);
  const [light, setLight] = useState<"rgb" | "dimmer" | null>(device.profile.features.light);
  const [lightPower, setLightPower] = useState(false);
  const [dimmer, setDimmer] = useState(100);
  const [color, setColor] = useState("#ffffff");

  const [firmwareVersion, setFirmwareVersion] = useState("");
  const [firmwareBuiltAt, setFirmwareBuiltAt] = useState("");
  const [firmwareCore, setFirmwareCore] = useState<string | null>(device.profile.firmwareCore);
  const [firmwareSdk, setFirmwareSdk] = useState<string | null>(device.profile.firmwareSdk);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateStarted, setUpdateStarted] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [hardwareChip, setHardwareChip] = useState<string | null>(device.profile.chip);
  const [templateName, setTemplateName] = useState<string | null>(device.profile.template?.name ?? null);
  const [profileRefreshing, setProfileRefreshing] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [chipTemperature, setChipTemperature] = useState<number | null>(null);
  const [loadAvg, setLoadAvg] = useState<number | null>(null);
  // uptime as reported, and when it was received, so it can keep counting
  const [uptimeBase, setUptimeBase] = useState<{ sec: number; at: number } | null>(null);
  const [uptime, setUptime] = useState<number | null>(null);
  const [offlineTimeout, setOfflineTimeout] = useState<number | null>(null);

  const [timers, setTimers] = useState<Timer[]>([]);

  const [rules, setRules] = useState<Rule[]>([]);

  const loadConfig = () => {
    api.getConfig(device.id).then((config) => {
      setSensorsFreq(config.telePeriod);
      setTimezone(config.timezone);
      setLedPower(config.led.ledPower);
      setLedMode(config.led.ledState);
      setLedPwmMode(config.led.ledPwmMode);
      setLedPwmOn(config.led.ledPwmOn);
      setLedPwmOff(config.led.ledPwmOff);
      if (config.led.lightPower != null) setLightPower(config.led.lightPower);
      if (config.led.dimmer != null) setDimmer(config.led.dimmer);
      if (config.led.color != null) setColor(config.led.color);
      setFirmwareVersion(config.firmware.version);
      setFirmwareBuiltAt(config.firmware.buildAt);
      setHardwareChip(config.hardware);
    });
  };

  useEffect(() => {
    setVoltageState(device.state.voltage);
    setPowerState(device.state.power);
  }, [device]);

  const timingLoading = useSectionLoad(openSection, "timing", () =>
    api.getTiming(device.id).then(data => {
      if (data.telePeriod != null) setSensorsFreq(data.telePeriod);
      if (data.timezone != null) setTimezone(data.timezone);
      setUptimeBase(data.uptimeSec != null ? { sec: data.uptimeSec, at: Date.now() } : null);
      setOfflineTimeout(data.offlineTimeout ?? null);
    }));

  const ledLoading = useSectionLoad(openSection, "led", () =>
    api.getLed(device.id).then(data => {
      if (data.ledPower != null) setLedPower(data.ledPower);
      if (data.ledState != null) setLedMode(data.ledState);
      if (data.ledPwmMode != null) setLedPwmMode(data.ledPwmMode);
      if (data.ledPwmOn != null) setLedPwmOn(data.ledPwmOn);
      if (data.ledPwmOff != null) setLedPwmOff(data.ledPwmOff);
      setStatusLed(data.statusLed ?? true);
      setLight(data.light ?? null);
      if (data.lightPower != null) setLightPower(data.lightPower);
      if (data.dimmer != null) setDimmer(data.dimmer);
      if (data.color != null) setColor(data.color);
    }));

  const hardwareLoading = useSectionLoad(openSection, "hardware", () =>
    api.getHardware(device.id).then(data => {
      setHardwareChip(data.hardware);
      setChipTemperature(data.chipTemperature ?? null);
      setLoadAvg(data.loadAvg ?? null);
      setFirmwareVersion(data.firmware.version ?? "");
      setFirmwareBuiltAt(data.firmware.buildAt ?? "");
      setFirmwareCore(data.firmware.core ?? null);
      setFirmwareSdk(data.firmware.sdk ?? null);
      setLatestVersion(data.firmware.latestVersion ?? null);
      setUpdateAvailable(data.firmware.updateAvailable === true);
    }));

  const refreshProfile = async () => {
    setProfileRefreshing(true);
    setProfileMsg(null);
    try {
      const refreshed = await api.refreshProfile(device.id);
      if (refreshed === null) {
        setProfileMsg({ ok: false, text: t('configPanel.refreshOffline') });
        return;
      }
      setHardwareChip(refreshed.profile.chip);
      setTemplateName(refreshed.profile.template?.name ?? null);
      setFirmwareVersion(refreshed.profile.firmwareVersion ?? "");
      setFirmwareBuiltAt(refreshed.profile.firmwareBuiltAt ?? "");
      setFirmwareCore(refreshed.profile.firmwareCore ?? null);
      setFirmwareSdk(refreshed.profile.firmwareSdk ?? null);
      if (refreshed.sensorType !== device.sensorType) {
        setProfileMsg({ ok: true, text: t('configPanel.refreshTypeChanged', { type: t('devicesAdmin.type_' + refreshed.sensorType, { defaultValue: refreshed.sensorType }) }) });
      } else {
        setProfileMsg({ ok: true, text: t('configPanel.refreshDone') });
      }
    } catch {
      setProfileMsg({ ok: false, text: t('configPanel.refreshError') });
    } finally {
      setProfileRefreshing(false);
    }
  };

  const upgradeFirmware = async () => {
    if (!window.confirm(t('configPanel.updateConfirm'))) return;
    setInProgress(true);
    setUpdateMsg(null);
    try {
      const status = await api.upgradeFirmware(device.id);
      if (status === 409) {
        setUpdateMsg({ ok: false, text: t('configPanel.updateOffline') });
      } else {
        setUpdateStarted(true);
        setUpdateMsg({ ok: true, text: t('configPanel.updateStarted') });
      }
    } catch {
      setUpdateMsg({ ok: false, text: t('configPanel.updateError') });
    } finally {
      setInProgress(false);
    }
  };

  const timersLoading = useSectionLoad(openSection, "timers", () => {
    setTimers([]);
    return api.getTimers(device.id).then(setTimers);
  });

  const rulesLoading = useSectionLoad(openSection, "rules", () => {
    setRules([]);
    return api.getRules(device.id).then(setRules);
  });

  useEffect(() => {
    if (openSection !== "timing") return;
    const base = device.state.deviceTime;
    const at = device.state.last * 1000;
    const tick = () => setDeviceTime(advanceDeviceTime(base, Date.now() - at));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [openSection, device.state.deviceTime, device.state.last]);

  useEffect(() => {
    if (openSection !== "timing" || !uptimeBase) {
      setUptime(null);
      return;
    }
    const tick = () => setUptime(uptimeBase.sec + Math.floor((Date.now() - uptimeBase.at) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [openSection, uptimeBase]);

  const run = async (action: () => Promise<void>) => {
    setInProgress(true);
    try {
      await action();
      await delay(1000);
      loadConfig();
    } finally {
      setInProgress(false);
    }
  };

  const switchOnOff = () =>
    run(() => api.control(device.id, "on-off", device.state.on ? "OFF" : "ON"));

  const updateTimer = (idx: number, field: keyof Timer, value: number | string) => {
    setTimers(prev => prev.map((t, i) => i === idx ? new Timer({ ...t, [field]: value }) : t));
  };

  const saveTimer = (idx: number) =>
    run(() => api.setTimer(device.id, timers[idx].n, timers[idx]));

  const updateRule = (idx: number, field: keyof Rule, value: number | string) => {
    setRules(prev => prev.map((r, i) => i === idx ? new Rule({ ...r, [field]: value }) : r));
  };

  const saveRule = (idx: number) =>
    run(() => api.setRule(device.id, rules[idx].n, rules[idx]));

  // Tasmota days string: index 0=Sun,1=Mon,...,6=Sat. Display order: Mon first.
  const dayDisplayOrder = [1, 2, 3, 4, 5, 6, 0];

  const timerDaySummary = (days: string): string => {
    if (!days || days.length < 7) return "";
    if (days === "1111111") return t('configPanel.timer_everyday');
    if (days === "0000000") return "";
    return dayDisplayOrder
      .filter(i => days[i] === "1")
      .map(i => t(`configPanel.day_${i}`))
      .join(" ");
  };

  const sectionTitles: Record<Exclude<Section, null>, string> = {
    power: t('configPanel.section_power'),
    timing: t('configPanel.section_timing'),
    led: t('configPanel.section_led'),
    calibration: t('configPanel.section_calibration'),
    hardware: t('configPanel.section_hardware'),
    timers: t('configPanel.section_timers'),
    rules: t('configPanel.section_rules'),
    notifications: t('notifications.title'),
  };

  const menuItems: { section: Exclude<Section, null>; icon: string }[] = [
    ...(device.supportsToggle ? [{ section: "power" as const, icon: "fa-power-off" }] : []),
    { section: "timing", icon: "fa-clock" },
    ...(!templateKnown || device.profile.features.statusLed || device.profile.features.light
      ? [{ section: "led" as const, icon: "fa-lightbulb" }] : []),
    ...(device.isEnergySensor() ? [{ section: "calibration" as const, icon: "fa-gauge" }] : []),
    { section: "hardware", icon: "fa-microchip" },
    { section: "timers", icon: "fa-stopwatch" },
    { section: "rules", icon: "fa-code" },
    { section: "notifications", icon: "fa-bell" },
  ];
  // live value from WebSocket telemetry, falling back to the snapshot fetched when the popup opened
  const chipTemp = device.state.chipTemperature ?? chipTemperature;
  const showChipChart = device.profile.features.chipTemp && onToggleChipChart != null;
  const wideSection = openSection === "timers" || openSection === "rules" || openSection === "notifications";

  return (
    <>
      <ButtonGroup size="sm" className="d-none d-md-inline-flex">
        {menuItems.map(item => (
          <Button key={item.section} variant="outline-secondary" title={sectionTitles[item.section]} onClick={() => setOpenSection(item.section)}>
            <i className={"fa " + item.icon}></i>
          </Button>
        ))}
        {showChipChart && (
          <Button
            variant={chipChartOpen ? "secondary" : "outline-secondary"}
            active={chipChartOpen}
            title={t('devicePage.chipTemperatureChart')}
            onClick={onToggleChipChart}
          >
            <i className="fa fa-chart-line"></i>
          </Button>
        )}
      </ButtonGroup>

      <Dropdown align="end" className="d-md-none ms-auto">
        <Dropdown.Toggle variant="outline-secondary" size="sm" aria-label={t('configPanel.menu')}>
          <i className="fa fa-bars"></i>
        </Dropdown.Toggle>
        <Dropdown.Menu>
          {menuItems.map(item => (
            <Dropdown.Item key={item.section} onClick={() => setOpenSection(item.section)}>
              <i className={"fa fa-fw me-2 " + item.icon}></i>{sectionTitles[item.section]}
            </Dropdown.Item>
          ))}
          {showChipChart && (
            <Dropdown.Item active={chipChartOpen} onClick={onToggleChipChart}>
              <i className="fa fa-fw me-2 fa-chart-line"></i>{t('devicePage.chipTemperatureChart')}
            </Dropdown.Item>
          )}
        </Dropdown.Menu>
      </Dropdown>

      <Modal show={openSection !== null} onHide={() => setOpenSection(null)} size={wideSection ? "lg" : undefined}>
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
              {timingLoading ? (
                <div className="text-center py-4 text-muted">
                  <i className="fa fa-spinner fa-spin me-2"></i>{t('configPanel.loading')}
                </div>
              ) : (
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
              {offlineTimeout != null && (
                <Form.Group as={Row} className="mb-3" controlId="cfgOfflineTimeout">
                  <Form.Label column sm="3">{t('configPanel.offlineTimeout')}</Form.Label>
                  <Col sm="9" className="d-flex align-items-center">
                    {formatElapsed(offlineTimeout)}
                    <span className="text-muted small ms-2">
                      ({device.offlineTimeout > 0 ? t('configPanel.offlineTimeoutFixed') : t('configPanel.offlineTimeoutAuto')})
                    </span>
                  </Col>
                </Form.Group>
              )}
              {uptime != null && (
                <Form.Group as={Row} className="mb-3" controlId="cfgUptime">
                  <Form.Label column sm="3">{t('configPanel.uptime')}</Form.Label>
                  <Col sm="9" className="d-flex align-items-center font-monospace">
                    <i className="fa fa-hourglass-half me-2 text-secondary"></i>{formatElapsed(uptime)}
                  </Col>
                </Form.Group>
              )}
              </>
              )}
            </>
          )}
          {openSection === "led" && (
            <>
              {ledLoading ? (
                <div className="text-center py-4 text-muted">
                  <i className="fa fa-spinner fa-spin me-2"></i>{t('configPanel.loading')}
                </div>
              ) : (
              <>
              {light && (
                <>
                  <h6 className="text-muted">{t(light === "rgb" ? 'configPanel.lightRgb' : 'configPanel.lightDimmer')}</h6>
                  <Form.Group as={Row} className="mb-3 align-items-center" controlId="cfgLightPower">
                    <Form.Label column sm="3">{t('configPanel.lightPower')}</Form.Label>
                    <Col sm="7">
                      <Form.Check type="switch" checked={lightPower} disabled={inProgress}
                        onChange={() => {
                          const next = !lightPower;
                          setLightPower(next);
                          run(() => api.control(device.id, "light-power", next ? "ON" : "OFF"));
                        }}/>
                    </Col>
                  </Form.Group>
                  <Form.Group as={Row} className="mb-3 align-items-center" controlId="cfgLightDimmer">
                    <Form.Label column sm="3">{t('configPanel.lightDimmer_value', { value: dimmer })}</Form.Label>
                    <Col sm="7">
                      <Form.Range value={dimmer} onChange={e => setDimmer(+e.target.value)} min={0} max={100}/>
                    </Col>
                    <Col sm="2">
                      <SaveBtn disabled={inProgress} onClick={() => run(() => api.control(device.id, "light-dimmer", dimmer.toString()))}/>
                    </Col>
                  </Form.Group>
                  {light === "rgb" && (
                    <Form.Group as={Row} className="mb-3 align-items-center" controlId="cfgLightColor">
                      <Form.Label column sm="3">{t('configPanel.lightColor')}</Form.Label>
                      <Col sm="7">
                        <Form.Control type="color" value={color} onChange={e => setColor(e.target.value)} title={color}/>
                      </Col>
                      <Col sm="2">
                        <SaveBtn disabled={inProgress} onClick={() => run(() => api.control(device.id, "light-color", color))}/>
                      </Col>
                    </Form.Group>
                  )}
                </>
              )}
              {statusLed && (
                <>
                  {light && <h6 className="text-muted">{t('configPanel.statusLed')}</h6>}
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
              {ledPwmMode && (
              <>
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
                </>
              )}
              {!statusLed && !light && (
                <div className="text-muted">{t('configPanel.noLed')}</div>
              )}
              </>
              )}
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
          {openSection === "timers" && (
            <>
              {timersLoading ? (
                <div className="text-center py-4 text-muted">
                  <i className="fa fa-spinner fa-spin me-2"></i>{t('configPanel.timer_loading')}
                </div>
              ) : (
                <Accordion style={{ maxHeight: "60vh", overflowY: "auto" }}>
                  {timers.map((timer, idx) => (
                    <Accordion.Item eventKey={String(idx)} key={idx}>
                      <Accordion.Header>
                        <span className="me-2 fw-semibold">{t('configPanel.timer')} {timer.n}</span>
                        {timer.enable === 1 ? (
                          <span className="text-success me-2">
                            <i className="fa fa-circle-check me-1"></i>
                            {timer.time}
                            {timerDaySummary(timer.days) && <span className="ms-2 font-monospace small">{timerDaySummary(timer.days)}</span>}
                            <span className="ms-2">{t(`configPanel.timer_action_${timer.action}`)}</span>
                          </span>
                        ) : (
                          <span className="text-muted small">{t('configPanel.timer_disabled')}</span>
                        )}
                      </Accordion.Header>
                      <Accordion.Body>
                        <Form>
                          <Form.Group as={Row} className="mb-2 align-items-center">
                            <Form.Label column sm="4">{t('configPanel.timer_enable')}</Form.Label>
                            <Col sm="8">
                              <Form.Check type="switch" checked={timer.enable === 1}
                                onChange={() => updateTimer(idx, 'enable', timer.enable === 1 ? 0 : 1)} />
                            </Col>
                          </Form.Group>
                          <Form.Group as={Row} className="mb-2 align-items-center">
                            <Form.Label column sm="4">{t('configPanel.timer_time')}</Form.Label>
                            <Col sm="8">
                              <Form.Control type="time" value={timer.time}
                                onChange={e => updateTimer(idx, 'time', e.target.value)} />
                            </Col>
                          </Form.Group>
                          <Form.Group as={Row} className="mb-2 align-items-center">
                            <Form.Label column sm="4">{t('configPanel.timer_days')}</Form.Label>
                            <Col sm="8">
                              <div className="d-flex gap-2">
                                {dayDisplayOrder.map(tasmotaIdx => (
                                  <Form.Check key={tasmotaIdx} type="checkbox"
                                    label={t(`configPanel.day_${tasmotaIdx}`)}
                                    checked={timer.days[tasmotaIdx] === "1"}
                                    onChange={() => {
                                      const d = timer.days.split("");
                                      d[tasmotaIdx] = d[tasmotaIdx] === "1" ? "0" : "1";
                                      updateTimer(idx, 'days', d.join(""));
                                    }} />
                                ))}
                              </div>
                            </Col>
                          </Form.Group>
                          <Form.Group as={Row} className="mb-2 align-items-center">
                            <Form.Label column sm="4">{t('configPanel.timer_action')}</Form.Label>
                            <Col sm="8">
                              <Form.Select value={timer.action}
                                onChange={e => updateTimer(idx, 'action', Number(e.target.value))}>
                                {([0, 1, 2, 3] as const).map(a => (
                                  <option key={a} value={a}>{t(`configPanel.timer_action_${a}`)}</option>
                                ))}
                              </Form.Select>
                            </Col>
                          </Form.Group>
                          <Form.Group as={Row} className="mb-2 align-items-center">
                            <Form.Label column sm="4">{t('configPanel.timer_repeat')}</Form.Label>
                            <Col sm="8">
                              <Form.Check type="switch" checked={timer.repeat === 1}
                                onChange={() => updateTimer(idx, 'repeat', timer.repeat === 1 ? 0 : 1)} />
                            </Col>
                          </Form.Group>
                          <Form.Group as={Row} className="mb-2 align-items-center">
                            <Form.Label column sm="4">{t('configPanel.timer_mode')}</Form.Label>
                            <Col sm="8">
                              <Form.Select value={timer.mode}
                                onChange={e => updateTimer(idx, 'mode', Number(e.target.value))}>
                                {([0, 1, 2] as const).map(m => (
                                  <option key={m} value={m}>{t(`configPanel.timer_mode_${m}`)}</option>
                                ))}
                              </Form.Select>
                            </Col>
                          </Form.Group>
                          <Form.Group as={Row} className="mb-2 align-items-center">
                            <Form.Label column sm="4">{t('configPanel.timer_output')}</Form.Label>
                            <Col sm="8">
                              <Form.Select value={timer.output}
                                onChange={e => updateTimer(idx, 'output', Number(e.target.value))}>
                                {[1, 2, 3, 4].map(o => (
                                  <option key={o} value={o}>{o}</option>
                                ))}
                              </Form.Select>
                            </Col>
                          </Form.Group>
                          <div className="d-flex justify-content-end mt-2">
                            <SaveBtn disabled={inProgress} onClick={() => saveTimer(idx)} />
                          </div>
                        </Form>
                      </Accordion.Body>
                    </Accordion.Item>
                  ))}
                </Accordion>
              )}
            </>
          )}
          {openSection === "rules" && (
            <>
              {rulesLoading ? (
                <div className="text-center py-4 text-muted">
                  <i className="fa fa-spinner fa-spin me-2"></i>{t('configPanel.rule_loading')}
                </div>
              ) : (
                <Accordion style={{ maxHeight: "60vh", overflowY: "auto" }}>
                  {rules.map((rule, idx) => (
                    <Accordion.Item eventKey={String(idx)} key={idx}>
                      <Accordion.Header>
                        <span className="me-2 fw-semibold">{t('configPanel.rule')} {rule.n}</span>
                        {rule.state === 1 ? (
                          <span className="text-success me-2">
                            <i className="fa fa-circle-check me-1"></i>
                            {rule.once === 1 && <span className="badge bg-secondary me-1">{t('configPanel.rule_once')}</span>}
                            <span className="font-monospace small text-truncate" style={{ maxWidth: "300px", display: "inline-block", verticalAlign: "middle" }}>{rule.rules || t('configPanel.rule_empty')}</span>
                          </span>
                        ) : (
                          <span className="text-muted small">{t('configPanel.rule_disabled')}</span>
                        )}
                      </Accordion.Header>
                      <Accordion.Body>
                        <Form>
                          <Form.Group as={Row} className="mb-2 align-items-center">
                            <Form.Label column sm="4">{t('configPanel.rule_enable')}</Form.Label>
                            <Col sm="8">
                              <Form.Check type="switch" checked={rule.state === 1}
                                onChange={() => updateRule(idx, 'state', rule.state === 1 ? 0 : 1)} />
                            </Col>
                          </Form.Group>
                          <Form.Group as={Row} className="mb-2 align-items-center">
                            <Form.Label column sm="4">{t('configPanel.rule_once')}</Form.Label>
                            <Col sm="8">
                              <Form.Check type="switch" checked={rule.once === 1}
                                onChange={() => updateRule(idx, 'once', rule.once === 1 ? 0 : 1)} />
                            </Col>
                          </Form.Group>
                          <Form.Group as={Row} className="mb-2">
                            <Form.Label column sm="4">{t('configPanel.rule_text')}</Form.Label>
                            <Col sm="8">
                              <Form.Control
                                as="textarea"
                                rows={5}
                                className="font-monospace"
                                style={{ fontSize: "0.8rem" }}
                                value={rule.rules}
                                onChange={e => updateRule(idx, 'rules', e.target.value)}
                                placeholder={t('configPanel.rule_placeholder')}
                              />
                              {rule.free > 0 && (
                                <Form.Text className="text-muted">
                                  {t('configPanel.rule_free', { free: rule.free })}
                                </Form.Text>
                              )}
                            </Col>
                          </Form.Group>
                          <div className="d-flex justify-content-end mt-2">
                            <SaveBtn disabled={inProgress} onClick={() => saveRule(idx)} />
                          </div>
                        </Form>
                      </Accordion.Body>
                    </Accordion.Item>
                  ))}
                </Accordion>
              )}
            </>
          )}
          {openSection === "notifications" && (
            <NotificationRules key={"notif-" + device.id} api={api} device={device} />
          )}
          {openSection === "hardware" && (
            <>
              {hardwareLoading ? (
                <div className="text-center py-4 text-muted">
                  <i className="fa fa-spinner fa-spin me-2"></i>{t('configPanel.loading')}
                </div>
              ) : (
              <Form>
                {templateName && (
                  <Form.Group as={Row} className="mb-3" controlId="cfgTemplate">
                    <Form.Label column sm="3">{t('configPanel.template')}</Form.Label>
                    <Col sm="9" className="d-flex align-items-center">{templateName}</Col>
                  </Form.Group>
                )}
                {hardwareChip && (
                  <Form.Group as={Row} className="mb-3" controlId="cfgChip">
                    <Form.Label column sm="3">{t('configPanel.chip')}</Form.Label>
                    <Col sm="9" className="d-flex align-items-center">
                      <i className="fa fa-microchip me-2 text-secondary"></i>{hardwareChip}
                    </Col>
                  </Form.Group>
                )}
                {chipTemp != null && (
                  <Form.Group as={Row} className="mb-3" controlId="cfgChipTemp">
                    <Form.Label column sm="3">{t('configPanel.chipTemperature')}</Form.Label>
                    <Col sm="9" className="d-flex align-items-center">
                      <i className="fa fa-temperature-half me-2 text-secondary"></i>{chipTemp.toFixed(1)} °C
                    </Col>
                  </Form.Group>
                )}
                {loadAvg != null && (
                  <Form.Group as={Row} className="mb-3" controlId="cfgLoadAvg">
                    <Form.Label column sm="3">{t('configPanel.loadAvg')}</Form.Label>
                    <Col sm="9" className="d-flex align-items-center">
                      <i className="fa fa-gauge me-2 text-secondary"></i>{loadAvg} %
                    </Col>
                  </Form.Group>
                )}
                <Form.Group as={Row} className="mb-3" controlId="cfgFwVersion">
                  <Form.Label column sm="3">{t('configPanel.version')}</Form.Label>
                  <Col sm="9" className="d-flex align-items-center">
                    <span className={latestVersion !== null && !updateAvailable ? "text-success" : undefined}>{firmwareVersion}</span>
                    {updateAvailable && latestVersion && (
                      <>
                        <i className="fa fa-arrow-right mx-2 text-secondary"></i>
                        <span title={t('configPanel.latestVersion')}>{latestVersion}</span>
                      </>
                    )}
                  </Col>
                </Form.Group>
                {updateAvailable && (
                  <Form.Group as={Row} className="mb-3">
                    <Col sm={{ span: 9, offset: 3 }}>
                      <Button variant="warning" size="sm" disabled={inProgress || updateStarted} onClick={upgradeFirmware}>
                        <i className="fa fa-download me-2"></i>{t('configPanel.updateFirmware')}
                      </Button>
                      {updateMsg && (
                        <div className={"mt-2 " + (updateMsg.ok ? "text-success" : "text-danger")}>{updateMsg.text}</div>
                      )}
                    </Col>
                  </Form.Group>
                )}
                <Form.Group as={Row} className="mb-3" controlId="cfgFwBuiltAt">
                  <Form.Label column sm="3">{t('configPanel.buildAt')}</Form.Label>
                  <Col sm="9" className="d-flex align-items-center">{firmwareBuiltAt}</Col>
                </Form.Group>
                {firmwareCore && (
                  <Form.Group as={Row} className="mb-3" controlId="cfgFwCore">
                    <Form.Label column sm="3">{t('configPanel.core')}</Form.Label>
                    <Col sm="9" className="d-flex align-items-center">{firmwareCore}</Col>
                  </Form.Group>
                )}
                {firmwareSdk && (
                  <Form.Group as={Row} className="mb-3" controlId="cfgFwSdk">
                    <Form.Label column sm="3">{t('configPanel.sdk')}</Form.Label>
                    <Col sm="9" className="d-flex align-items-center">{firmwareSdk}</Col>
                  </Form.Group>
                )}
                <Form.Group as={Row} className="mb-3">
                  <Col sm={{ span: 9, offset: 3 }}>
                    <Button variant="outline-secondary" size="sm" disabled={profileRefreshing} onClick={refreshProfile}
                      title={t('devicesAdmin.refreshProfile')}>
                      <i className={"fa fa-rotate me-2" + (profileRefreshing ? " fa-spin" : "")}></i>{t('configPanel.refreshProfile')}
                    </Button>
                    {profileMsg && (
                      <div className={"mt-2 small " + (profileMsg.ok ? "text-success" : "text-danger")}>{profileMsg.text}</div>
                    )}
                  </Col>
                </Form.Group>
              </Form>
              )}
            </>
          )}
        </Modal.Body>
      </Modal>
    </>
  );
}
