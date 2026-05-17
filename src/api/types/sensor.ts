'use client';

export default class SensorEvent {
    public deviceId: number;
    public deviceTime: number;
    
    public power: number;
    public current: number;
    public voltage: number;

    public co2: number;
    public co2e: number;
    public temperature: number;
    public humidity: number;

    constructor(decoded: any) {
        this.deviceId = decoded.deviceId;
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
