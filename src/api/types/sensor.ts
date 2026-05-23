'use client';

export default class SensorEvent {
    public deviceId: number;
    public time: number;
    public deviceTime: string;

    public power: number | null;
    public current: number | null;
    public voltage: number | null;

    public co2: number | null;
    public co2e: number | null;
    public temperature: number | null;
    public humidity: number | null;

    constructor(decoded: any) {
        this.deviceId = decoded.deviceId;
        this.time = decoded.time;
        this.deviceTime = decoded.deviceTime;
        this.power = decoded.power;
        this.current = decoded.current;
        this.voltage = decoded.voltage;

        this.co2 = decoded.co2;
        this.co2e = decoded.co2e;
        this.temperature = decoded.temperature;
        this.humidity = decoded.humidity;
    }
}
