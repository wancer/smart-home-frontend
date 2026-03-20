import { useEffect, useState } from "react";
import "./App.scss";
import Record from "./sensor.ts";
import Device from "./device.ts";
import Api from "./api.ts";
import {DevicePage} from "./page/device-page.tsx"
import {MenuRow} from "./page/menu-row.tsx"
import useWebSocket, { ReadyState } from "react-use-websocket"
import {BrowserRouter, Routes, Route, } from "react-router-dom";


type MenuProperties = {
  devices: Device[];
};

function Menu({ devices }: MenuProperties) {
  return (
    <div className="col-md-3 left_col">
      <div className="left_col scroll-view">
        <div className="navbar nav_title" style={{ border: 0 }}>
          <a href="index.html" className="site_title">
            <span>Energy Monitor</span>
          </a>
        </div>

        <div className="clearfix"></div>

        <div
          id="sidebar-menu"
          className="main_menu_side hidden-print main_menu"
        >
          <div className="menu_section">
            <h3>Devices</h3>
            <ul className="nav side-menu">
              {devices.map((device: Device) => MenuRow(device))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [records, setRecords] = useState<Record[]>([]);
  const [events, setEvent] = useState<MessageEvent<any>[]>([]);
  const [lastEvents, setLastEvent] = useState({});

  const api = new Api();

  useEffect(() => {
    api.devices().then((devices) => {
      setDevices(devices);
    });

    api.sensors().then((records) => {
      setRecords(records);
    });
  }, []);



  const [socketUrl, setSocketUrl] = useState(import.meta.env.VITE_API_URL +'/api/ws');
  const { sendMessage, lastMessage, readyState } = useWebSocket(socketUrl);

  useEffect(() => {
    if (lastMessage !== null) {
      const parsed = JSON.parse(lastMessage.data);
      if (parsed.channel === 'sensor') {
        console.log(parsed.body);
        setEvent((prev: any) => prev.concat(lastMessage));
        setLastEvent(prevState => ({...prevState, [parsed.body.DeviceId]: parsed.body }));
        return;
      } 
      console.warn("unkown type", parsed)
    }
  }, [lastMessage]);

  return (
    <BrowserRouter>
      <div>
        <div className="container body">
          <div className="main_container">
            <Menu devices={devices} />

            <Routes>
              <Route
                path="/device/:id"
                element={<DevicePage devices={devices} records={records} lastEvents={lastEvents} />}
              />
            </Routes>
          </div>
        </div>
        
        <footer>
          <ul className="list-inline">
            <li>
              <strong>Device name:</strong> device.name
            </li>
            <li>
              <strong>Model:</strong> device.model
            </li>
            <li>
              <strong>Sw ver:</strong> device.softwareVersion
            </li>
            <li>
              <strong>Hw ver:</strong> device.hardwareVersion
            </li>
          </ul>
        </footer>
      </div>
    </BrowserRouter>
  );
}

export default App;
