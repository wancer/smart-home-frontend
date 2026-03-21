'use client';

export default class SensorEvent {
    public deviceId: number;
    public deviceTime: number;
    public period: number;
    public power: number;
    public current: number;
    public voltage: number;

    constructor(decoded: any) {
        this.deviceId = decoded.deviceId;
        this.deviceTime = decoded.deviceTime;
        this.period = decoded.period;
        this.power = decoded.power;
        this.current = decoded.current;
        this.voltage = decoded.voltage;
    }
}
