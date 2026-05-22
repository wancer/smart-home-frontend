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

function MenuRow(device: DeviceEvent, key: string, onClick: MouseEventHandler<HTMLAnchorElement>) {
  return (
    <li key={key}>
      <Link to={"/device/" + device.id} className="nav-link" onClick={ onClick } >
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

export default function Menu({ devices }: MenuProperties) {
  const { t } = useTranslation();
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
                <i className={"fa-solid fa-gauge"}></i> {t('menu.dashboard')}
              </Link>
            </li>
            {Object.values(devices).filter((d) => d.enabled).map((device: DeviceEvent) => MenuRow(device, "menu-desktop-device-" + device.id, () => {}))}
          </ul>
          <ul className="nav flex-column mt-auto" style={{borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 8}}>
            <li className="nav-item">
              <Link to={"/devices"} className="nav-link">
                <i className={"fa-solid fa-gear"}></i> {t('menu.devices')}
              </Link>
            </li>
            <li className="nav-item d-flex align-items-center">
              <LangSwitcher />
              <ThemeToggle />
            </li>
          </ul>
        </div>
      </Nav>

      <Button variant="secondary" onClick={handleShow} className="col-2 d-block d-md-none" style={{marginLeft: 15}} >
        <i className="fa fa-bars"></i>
      </Button>

      <Offcanvas show={show} onHide={handleClose}>
        <Offcanvas.Header closeButton />
        <Offcanvas.Body>
          <Nav className="">
            <div className="sidebar-sticky">
              <ul className="nav flex-column">
                <li className="nav-item">
                  <Link to={"/"} className="nav-link" onClick={handleClose}>
                    <i className={"fa-solid fa-gauge"}></i> {t('menu.dashboard')}
                  </Link>
                </li>
                {Object.values(devices).filter((d) => d.enabled).map((device: DeviceEvent) => MenuRow(device, "menu-mobile-device-" + device.id, handleClose))}
              </ul>
              <ul className="nav flex-column" style={{borderTop: "1px solid rgba(0,0,0,0.1)", paddingTop: 8, marginTop: 8}}>
                <li className="nav-item">
                  <Link to={"/devices"} className="nav-link" onClick={handleClose}>
                    <i className={"fa-solid fa-gear"}></i> {t('menu.devices')}
                  </Link>
                </li>
                <li className="nav-item d-flex align-items-center">
                  <LangSwitcher />
                  <ThemeToggle />
                </li>
              </ul>
            </div>
          </Nav>
        </Offcanvas.Body>
      </Offcanvas>
    </>
  );
}
