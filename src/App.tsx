"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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

export type DataPoint = { time: number; value: number };
export type HistoryMap = Record<number, DataPoint[] | undefined>;

const FIVE_MIN_S = 300;

type AuthorizedUserAppProperties = {
  api: HttpApi;
};

export function AuthorizedUserApp({api}: AuthorizedUserAppProperties ) {
  const { t } = useTranslation();
  const [devices, setDevices] = useState<DeviceEvent[]>([]);
  const [historyMap, setHistoryMap] = useState<HistoryMap>({});
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
        device.state.deviceTime = exact.deviceTime;

        device.state.co2 = exact.co2;
        device.state.co2e = exact.co2e;
        device.state.temperature = exact.temperature;
        device.state.humidity = exact.humidity;

        const value = device.isEnergySensor() ? exact.power
                    : device.isCo2Sensor()    ? exact.co2e
                    : exact.temperature;
        const now = exact.time;
        setHistoryMap(prev => {
          const cutoff = now - FIVE_MIN_S;
          const existing = (prev[exact.deviceId] ?? []).filter(p => p.time >= cutoff);
          return { ...prev, [exact.deviceId]: [...existing, { time: now, value }] };
        });

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
    api.devices().then(async (devices) => {
      // devices.sort((a: DeviceEvent, b:DeviceEvent) => (a.name > b.name) ? 1 : -1)
      setDevices(devices);
      setLoading(false);

      Object.values(devices)
        .filter(d => d.enabled)
        .forEach(async (device) => {
          const records = await api.sensors(device.id);
          const points: DataPoint[] = records
            .flatMap(s => {
              const value = device.isEnergySensor() ? s.power
                          : device.isCo2Sensor()    ? s.co2e
                          : s.temperature;
              return value != null ? [{ time: s.time, value }] : [];
            })
            .sort((a, b) => a.time - b.time);
          setHistoryMap(prev => ({ ...prev, [device.id]: points }));
        });
    });
  }, []);

  if (isLoading) {
    return (
      <Spinner animation="border" role="status">
        <span className="visually-hidden">{t('app.loading')}</span>
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
                      <Route index path="/" element={<DashboardPage devices={devices} historyMap={historyMap} api={api}/>} />
                      <Route path="/device/:idStr" element={<DevicePage api={api} devices={devices} />}/>
                      <Route path="/devices" element={<DevicesAdminPage api={api} devices={devices} onDevicesChange={setDevices} />}/>
                    </Routes>
                  </div>
                </main>
            </Row>
        </Container>
    </BrowserRouter>;
}
