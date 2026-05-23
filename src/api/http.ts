import DeviceEvent from "./types/device";
import Login from "./types/login";
import SensorEvent from "./types/sensor";
import { CredentialResponse } from '@react-oauth/google';
import SensorDailyEvent from "./types/sensor-daily";
import SensorEventStat from "./types/sensor-event-stat";
import Config from "./types/config";

export default class HttpApi {

    public token

    constructor(token: string) {
        this.token = token;
    }

    public async sensorsMulti(deviceIds: number[]): Promise<Record<number, SensorEvent[]>> {
        try {
            const qs = deviceIds.map(id => `ids=${id}`).join('&');
            const response = await fetch(
                import.meta.env.VITE_API_URL + `/api/sensors?${qs}`,
                {
                    headers: {
                        'Authorization': 'Bearer ' + this.token,
                    }
                }
            );
            const data: Record<string, SensorEvent[]> = await response.json();
            const result: Record<number, SensorEvent[]> = {};
            for (const [key, value] of Object.entries(data)) {
                result[Number(key)] = value;
            }
            return result;
        } catch (e) {
            console.error((e as Error).message);
            return {};
        }
    }

    public async sensorsDaily(deviceId: number): Promise<SensorDailyEvent[]> {
        const response = await fetch(
            import.meta.env.VITE_API_URL + `/api/devices/${deviceId}/sensors/daily`,
            {
                headers: {
                    'Authorization': 'Bearer ' + this.token,
                }
            }
        );
        return response.json();
    }

    public async sensorsConfigurable(deviceId: number, duration: string, scale: string): Promise<SensorEventStat[]> {
        const response = await fetch(
            import.meta.env.VITE_API_URL + `/api/devices/${deviceId}/sensors/${duration}/${scale}`,
            {
                headers: {
                    'Authorization': 'Bearer ' + this.token,
                }
            }
        );
        return response.json();
    }

    public async devices(): Promise<DeviceEvent[]> {
        const response = await fetch(
            import.meta.env.VITE_API_URL + '/api/devices',
            {
                headers: {
                    'Authorization': 'Bearer ' + this.token,
                }
            }
        );
        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }
        const parsed = await response.json();

        Object.keys(parsed).map(
            (key) => { parsed[key] = new DeviceEvent(parsed[key])},
        );

        return parsed;
    }

    public async device(deviceId: number): Promise<DeviceEvent> {
        const response = await fetch(
            import.meta.env.VITE_API_URL + `/api/devices/${deviceId}`,
            {
                headers: {
                    'Authorization': 'Bearer ' + this.token,
                }
            }
        );
        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }
        const parsed = response.json()
        return parsed;
    }

    public async createDevice(data: { name: string; topic: string; enabled: boolean; sensorType: string; supportsToggle: boolean }): Promise<DeviceEvent> {
        const response = await fetch(
            import.meta.env.VITE_API_URL + '/api/devices',
            {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + this.token,
                },
                body: JSON.stringify(data),
            }
        );
        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }
        const parsed = await response.json();
        return new DeviceEvent(parsed);
    }

    public async updateDevice(deviceId: number, data: { name: string; topic: string; enabled: boolean; sensorType: string; supportsToggle: boolean }): Promise<DeviceEvent> {
        const response = await fetch(
            import.meta.env.VITE_API_URL + `/api/devices/${deviceId}`,
            {
                method: 'PUT',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + this.token,
                },
                body: JSON.stringify(data),
            }
        );
        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }
        const parsed = await response.json();
        return new DeviceEvent(parsed);
    }

    public async deleteDevice(deviceId: number): Promise<void> {
        const response = await fetch(
            import.meta.env.VITE_API_URL + `/api/devices/${deviceId}`,
            {
                method: 'DELETE',
                headers: {
                    'Authorization': 'Bearer ' + this.token,
                },
            }
        );
        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }
    }

    public async login(google: CredentialResponse): Promise<Login> {
        const response = await fetch(
            import.meta.env.VITE_API_URL + '/api/auth/login',
            {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(google),
            }
        );
        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }
        return response.json()
    }

    public async getConfig(deviceId: number): Promise<Config> {
        const response = await fetch(
            import.meta.env.VITE_API_URL + `/api/devices/${deviceId}/control`,
            {
                headers: {
                    'Authorization': 'Bearer ' + this.token,
                }
            }
        );
        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }
        return response.json()
    }

    public async control(deviceId: number, parameter: string, value: string): Promise<void> {
        const response = await fetch(
            import.meta.env.VITE_API_URL + `/api/devices/${deviceId}/control`,
            {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + this.token,
                },
                body: JSON.stringify({"deviceId": deviceId,"parameter": parameter, "value": value}),
            }
        );
        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }
    }
}