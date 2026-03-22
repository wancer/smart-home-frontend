

import { useEffect, useState } from "react";
import SensorEvent from "./api/types/sensor.ts";
import DeviceEvent from "./api/types/device.ts";
import HttpApi from "./api/http.ts";
import {DevicePage} from "./page/device-page.tsx"
import useWebSocket from "react-use-websocket"
import {BrowserRouter, Routes, Route, } from "react-router-dom";

import Menu from "./page/menu.tsx";
import { DashboardPage } from "./page/dashboard.tsx";
import DeviceControlPage from "./page/device-control-page.tsx";

type AuthorizedUserAppProperties = {
  api: HttpApi;
};

export function AuthorizedUserApp({api}: AuthorizedUserAppProperties ) {
  const [socketUrl] = useState(import.meta.env.VITE_API_URL +'/api/ws?jwt=' + api.token);
  const { lastMessage } = useWebSocket(socketUrl);

  useEffect(() => {
    if (lastMessage !== null) {
      const parsed = JSON.parse(lastMessage.data);

      if (parsed.channel === 'sensor') {
        const exact = new SensorEvent(parsed.body);
            for (const device of devices) {
              if (device.id === exact.deviceId) {
                device.state.current = exact.current;
                device.state.voltage = exact.voltage;
                device.state.power = exact.power;
              }
            }

            records.push(exact);

            return;
      } 
      
      if (parsed.channel === 'state') {
          const exact = new DeviceEvent(parsed.body);

          const newDevices = devices.map((device: DeviceEvent): DeviceEvent => {
            return device.id === exact.id ? exact : device;
          });

          setDevices(newDevices)

          return;
      } 
      console.warn("unkown type", parsed)
    }
  }, [lastMessage]);

  const [devices, setDevices] = useState<DeviceEvent[]>([]);
  const [records, setRecords] = useState<SensorEvent[]>([]);

  useEffect(() => {
    api.devices().then((devices) => {
      devices.sort((a: DeviceEvent, b:DeviceEvent) => (a.name > b.name) ? 1 : -1)
      setDevices(devices);
    });

    api.sensors().then((records) => {
      setRecords(records);
    });
  }, []);

  return <BrowserRouter>
        <div className="container-fluid">
            <div className="row">
                <nav className="col-md-2 d-none d-md-block sidebar">
                    <Menu devices={devices} />
                </nav>

                <main className="col-md-9 ml-sm-auto col-lg-10 pt-3 px-4" role="main">
                  <div className="justify-content-between align-items-center border-bottom">
                    <Routes>
                      <Route index path="/" element={<DashboardPage devices={devices}/>} />
                      <Route path="/device/:id" element={<DevicePage devices={devices} records={records} />}/>
                      <Route path="/device/:id/control" element={<DeviceControlPage devices={devices} api={api} />}/>
                    </Routes>
                  </div>
                </main>
            </div>
        </div>
    </BrowserRouter>;
}
