'use client';

import { MetricValues, readMetrics } from "../../metrics";

export class SensorEvent implements MetricValues {
    public deviceId: number;
    public time: number;
    public deviceTime: string;

    // null = the device doesn't report it
    public power!: number | null;
    public current!: number | null;
    public voltage!: number | null;
    public temperature!: number | null;
    public humidity!: number | null;
    public co2!: number | null;
    public pressure!: number | null;
    public dcPower!: number | null;
    public dcCurrent!: number | null;
    public dcVoltage!: number | null;

    public chipTemperature: number | null;

    constructor(decoded: any) {
        this.deviceId = decoded.deviceId;
        this.time = decoded.time;
        this.deviceTime = decoded.deviceTime;
        Object.assign(this, readMetrics(decoded));
        this.chipTemperature = decoded.chipTemperature ?? null;
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
