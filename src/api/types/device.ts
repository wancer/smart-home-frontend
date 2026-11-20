'use client';

import { MetricValues, readMetrics } from "../../metrics";

class DeviceState implements MetricValues {
    public on: boolean|null;
    public last: number;
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
        this.on = decoded.on;
        this.last = decoded.last;
        this.deviceTime = "";
        Object.assign(this, readMetrics(decoded));
        this.chipTemperature = decoded.chipTemperature ?? null;
    }
}

export type SensorHistory = {
    aggregates: number;
    daily: number;
    archived: number;
    oldest: number | null;
};

/** Sensor data retention step: buckets of `step` seconds (0 = raw readings) kept for `keep` seconds (0 = forever). */
export type StorageTier = {
    step: number;
    keep: number;
};

export default class DeviceEvent {
    public id: number;
    public name: string;
    public topic: string;
    public enabled: boolean;
    public state: DeviceState;
    public sensorType: string;
    public supportsToggle: boolean;
    public storeChipTemp: boolean;
    /** Seconds without telemetry before the device is marked offline; 0 = auto (2×TelePeriod + 30 s). */
    public offlineTimeout: number;
    public sensorHistory?: SensorHistory;
    public storageTiers: StorageTier[];

    constructor(decoded: any) {
        this.id = decoded.id;
        this.name = decoded.name;
        this.topic = decoded.topic ?? '';
        this.enabled = decoded.enabled ?? true;
        this.state = new DeviceState(decoded.state)
        this.sensorType = decoded.sensorType;
        this.supportsToggle = decoded.supportsToggle;
        this.storeChipTemp = decoded.storeChipTemp ?? false;
        this.offlineTimeout = decoded.offlineTimeout ?? 0;
        this.sensorHistory = decoded.sensorHistory ?? undefined;
        this.storageTiers = decoded.storageTiers ?? [{ step: 300, keep: 0 }];
    }

    /** Whether the newest data is stored as raw readings rather than buckets. */
    public storesRaw(): boolean {
        return this.storageTiers[0]?.step === 0;
    }

    public isEnergySensor(): boolean {
        return this.sensorType === 'energy';
    }

    public isCo2Sensor(): boolean {
        return this.sensorType === 'co2';
    }

    public isThSensor(): boolean {
        return this.sensorType === 't-h';
    }

    public isMultiSensor(): boolean {
        return this.sensorType === 'multi';
    }

    public isIrRemote(): boolean {
        return this.sensorType === 'ir';
    }
}
