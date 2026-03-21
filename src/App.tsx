import "./App.scss";

import { useEffect, useState } from "react";
import SensorEvent from "./api/types/sensor.ts";
import DeviceEvent from "./api/types/device.ts";
import HttpApi from "./api/http.ts";
import {DevicePage} from "./page/device-page.tsx"
import useWebSocket from "react-use-websocket"
import {BrowserRouter, Routes, Route, } from "react-router-dom";

import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import Menu from "./page/menu.tsx";
import { DashboardPage } from "./page/dashboard.tsx";
import DeviceControlPage from "./page/device-control-page.tsx";

const localStorageField = "jwt";

function App() {
  const jwt = localStorage.getItem(localStorageField);
  const [isLoggedIn, setLoggedIn] = useState<boolean>(jwt !== null);
  const [api] = useState<HttpApi>(new HttpApi(jwt || ""));

  return <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
    { !isLoggedIn && <div id="login-center"> <GoogleLogin 
        onSuccess={credentialResponse => {
          api.login(credentialResponse)
            .then(
              apiResponse => {
                localStorage.setItem(localStorageField, apiResponse.token)
                api.token = apiResponse.token;
                setLoggedIn(true)
              }
            )
            .catch(err => console.error(err))
          ;
        }}
        onError={() => {
          console.log('Login Failed');
        }}
      />
      </div>
      }

     { isLoggedIn && <AuthorizedUserApp api={api}></AuthorizedUserApp>}

  </GoogleOAuthProvider>;
}


type AuthorizedUserAppProperties = {
  api: HttpApi;
};

function AuthorizedUserApp({api}: AuthorizedUserAppProperties ) {
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
        <div className="container">
            <div className="row">
                <div className="col-md-3">
                    <Menu devices={devices} />
                </div>

                <div className="col-md-9">
                    <Routes>
                      <Route index path="/" element={<DashboardPage devices={devices}/>} />
                      <Route path="/device/:id" element={<DevicePage devices={devices} records={records} />}/>
                      <Route path="/device/:id/control" element={<DeviceControlPage devices={devices} api={api} />}/>
                    </Routes>
                </div>
            </div>
        </div>
    </BrowserRouter>;
}

export default App;
