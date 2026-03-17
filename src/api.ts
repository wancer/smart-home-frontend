import SensorEvent from "./sensor";

export default class Api {

    public async sensors(): Promise<SensorEvent[]> {
        try {
            const response = await fetch(import.meta.env.VITE_API_URL + '/api/sensors');
            const parsed = response.json();
            return parsed;
        } catch (e) {
            console.error((e as Error).message);
            return [];
        }
    }

    public async devices(): Promise<SensorEvent | null> {
        try {
            const response = await fetch(import.meta.env.VITE_API_URL + '/api/devices');
            if (!response.ok) {
                throw new Error(`Response status: ${response.status}`);
            }
            const parsed = response.json()
            return parsed;
        } catch (e) {
            console.error((e as Error).message);
            return null;
        }
    }
}