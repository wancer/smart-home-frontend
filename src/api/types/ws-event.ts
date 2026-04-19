'use client';

export class SensorEvent {
    public deviceId: number;
    public time: number;
    public power: number;
    public current: number;
    public voltage: number;

    constructor(decoded: any) {
        this.deviceId = decoded.deviceId;
        this.time = decoded.deviceTime;
        this.power = decoded.power;
        this.current = decoded.current;
        this.voltage = decoded.voltage;
    }
}

export class StateEvent {
    public deviceId: number;
    public on: boolean|null;

    constructor(decoded: any) {
        this.deviceId = decoded.deviceId;
        this.on = decoded.on
    }
}
