"use client";

import { useEffect, useState } from "react";
import { SensorEvent, StateEvent } from "./api/types/ws-event.ts";
import DeviceEvent from "./api/types/device.ts";
import HttpApi from "./api/http.ts";
import {DevicePage} from "./page/device-page.tsx"
import useWebSocket from "react-use-websocket"
import {BrowserRouter, Routes, Route, } from "react-router-dom";
import { Container, Row, Spinner } from 'react-bootstrap';

import Menu from "./page/menu.tsx";
import { DashboardPage } from "./page/dashboard.tsx";
import DevicesAdminPage from "./page/devices-admin-page.tsx";

type AuthorizedUserAppProperties = {
  api: HttpApi;
};

export function AuthorizedUserApp({api}: AuthorizedUserAppProperties ) {
  const [devices, setDevices] = useState<DeviceEvent[]>([]);
  const [isLoading, setLoading] = useState(true); // Loading state
  const [socketUrl] = useState(import.meta.env.VITE_API_URL +'/api/ws?jwt=' + api.token);
  const { lastMessage } = useWebSocket(
    socketUrl,
  );

  useEffect(() => {
    if (lastMessage !== null) {
      const parsed = JSON.parse(lastMessage.data);

      if (parsed.channel === 'sensor') {
        console.log('sensor', parsed)
        const exact = new SensorEvent(parsed.body);
        const device = devices[exact.deviceId];

        device.state.current = exact.current;
        device.state.voltage = exact.voltage;
        device.state.power = exact.power;
        device.state.last = exact.time;

        device.state.co2 = exact.co2;
        device.state.co2e = exact.co2e;
        device.state.temperature = exact.temperature;
        device.state.humidity = exact.humidity;

        return;
      } 
      
      if (parsed.channel === 'state') {
        console.log('state', parsed)
        const exact = new StateEvent(parsed.body);
        const device = devices[exact.deviceId];
        device.state.on = exact.on;
        return;
      } 

      console.warn("unkown type", parsed)
    }
  }, [lastMessage]);

  useEffect(() => {
    api.devices().then((devices) => {
      // devices.sort((a: DeviceEvent, b:DeviceEvent) => (a.name > b.name) ? 1 : -1)
      setDevices(devices);
      setLoading(false);
    });
  }, []);

  if (isLoading) {
    return (
      <Spinner animation="border" role="status">
        <span className="visually-hidden">Loading...</span>
      </Spinner>
    );
  }

  return <BrowserRouter>
        <Container fluid>
            <Row>
                <Menu devices={devices} />

                <main className="col-md-9 ml-sm-auto col-lg-10 pt-3 px-4" role="main">
                  <div className="justify-content-between align-items-center border-bottom" style={{paddingBottom: 20}}>
                    <Routes>
                      <Route index path="/" element={<DashboardPage devices={devices}/>} />
                      <Route path="/device/:idStr" element={<DevicePage api={api} devices={devices} />}/>
                      <Route path="/devices" element={<DevicesAdminPage api={api} devices={devices} onDevicesChange={setDevices} />}/>
                    </Routes>
                  </div>
                </main>
            </Row>
        </Container>
    </BrowserRouter>;
}
