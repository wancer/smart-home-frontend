"use client";

import { Link } from "react-router-dom";
import { MouseEventHandler, useState } from "react";
import { Nav, Button, Offcanvas, ButtonGroup } from "react-bootstrap";
import { useTranslation } from "react-i18next";

import DeviceEvent from "../api/types/device";
import PowerIcon from "../element/power-icon";
import { themeManager, Theme } from "../ThemeManager";

type MenuProperties = {
  devices: DeviceEvent[];
};

const SEPARATOR = { borderTop: "1px solid rgba(128,128,128,0.2)", marginTop: 8, paddingTop: 8 };

function MenuRow(device: DeviceEvent, key: string, onClick: MouseEventHandler<HTMLAnchorElement>) {
  return (
    <li key={key}>
      <Link to={"/device/" + device.id} className="nav-link" onClick={onClick}>
        <PowerIcon device={device} />
        {device.name}
      </Link>
    </li>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(themeManager.getTheme());

  const toggle = () => {
    themeManager.toggle();
    setTheme(themeManager.getTheme());
  };

  return (
    <Button variant="outline-secondary" size="sm" onClick={toggle} style={{ margin: "8px 12px" }}>
      <i className={theme === Theme.Dark ? "fa fa-sun" : "fa fa-moon"}></i>
    </Button>
  );
}

function LangSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language;

  const change = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem("lang", lang);
  };

  return (
    <ButtonGroup size="sm" style={{ padding: "8px 12px" }}>
      <Button
        variant={current === "en" ? "secondary" : "outline-secondary"}
        onClick={() => change("en")}
      >EN</Button>
      <Button
        variant={current === "uk" ? "secondary" : "outline-secondary"}
        onClick={() => change("uk")}
      >UA</Button>
    </ButtonGroup>
  );
}

function NavLinks({ devices, onClose }: { devices: DeviceEvent[]; onClose: MouseEventHandler<HTMLAnchorElement> }) {
  const { t } = useTranslation();

  return (
    <div className="sidebar-sticky">
      {/* Section 1: main nav */}
      <ul className="nav flex-column">
        <li className="nav-item">
          <Link to={"/"} className="nav-link" onClick={onClose}>
            <i className="fa-solid fa-gauge"></i> {t('menu.dashboard')}
          </Link>
        </li>
        <li className="nav-item">
          <Link to={"/report"} className="nav-link" onClick={onClose}>
            <i className="fa-solid fa-chart-bar"></i> {t('menu.report')}
          </Link>
        </li>
      </ul>

      {/* Section 2: device list */}
      <ul className="nav flex-column" style={SEPARATOR}>
        {Object.values(devices).filter((d) => d.enabled).map((device: DeviceEvent) =>
          MenuRow(device, "menu-device-" + device.id, onClose)
        )}
      </ul>

      {/* Section 3: settings */}
      <ul className="nav flex-column mt-auto" style={SEPARATOR}>
        <li className="nav-item">
          <Link to={"/devices"} className="nav-link" onClick={onClose}>
            <i className="fa-solid fa-gear"></i> {t('menu.settings')}
          </Link>
        </li>
        <li className="nav-item d-flex align-items-center">
          <LangSwitcher />
          <ThemeToggle />
        </li>
      </ul>
    </div>
  );
}

export default function Menu({ devices }: MenuProperties) {
  const [show, setShow] = useState(false);

  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);
  const noOp: MouseEventHandler<HTMLAnchorElement> = () => {};

  return (
    <>
      <Nav className="col-md-3 col-lg-2 d-none d-sm-none d-md-block sidebar">
        <NavLinks devices={devices} onClose={noOp} />
      </Nav>

      <Button variant="secondary" onClick={handleShow} className="col-2 d-block d-md-none" style={{ marginLeft: 15 }}>
        <i className="fa fa-bars"></i>
      </Button>

      <Offcanvas show={show} onHide={handleClose}>
        <Offcanvas.Header closeButton />
        <Offcanvas.Body>
          <Nav>
            <NavLinks devices={devices} onClose={handleClose} />
          </Nav>
        </Offcanvas.Body>
      </Offcanvas>
    </>
  );
}
