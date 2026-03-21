import DeviceEvent from "./types/device";
import Login from "./types/login";
import SensorEvent from "./types/sensor";
import { CredentialResponse } from '@react-oauth/google';

export default class HttpApi {

    public token

    constructor(token: string) {
        this.token = token;
    }

    public async sensors(): Promise<SensorEvent[]> {
        try {
            const response = await fetch(
                import.meta.env.VITE_API_URL + '/api/sensors',                
                {
                    headers: {
                        'Authorization': 'Bearer ' + this.token,
                    }
                }
            );
            const parsed = response.json();
            return parsed;
        } catch (e) {
            console.error((e as Error).message);
            return [];
        }
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
        const parsed = response.json()
        return parsed;
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
        const parsed = response.json()
        return parsed;
    }

    public async control(deviceId: number, parameter: string, value: string): Promise<void> {
        const response = await fetch(
            import.meta.env.VITE_API_URL + '/api/device/control',
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