class DeviceState {
    public on: boolean|null;
    public last: number;
    public deviceTime: string;

    public power: number;
    public current: number;
    public voltage: number;

    public co2: number;
    public temperature: number;
    public humidity: number;

    public chipTemperature: number | null;

    constructor(decoded: any) {
        this.on = decoded.on;
        this.last = decoded.last;
        this.deviceTime = "";

        this.power = decoded.power;
        this.current = decoded.current;
        this.voltage = decoded.voltage;

        this.co2 = decoded.co2;
        this.temperature = decoded.temperature;
        this.humidity = decoded.humidity;

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

/** Tasmota GPIO template, as read from the device. */
export type DeviceTemplate = {
    name: string;
    gpio: number[];
    flag: number;
    base: number;
};

/** What the profile says the UI can offer; template-based values are 0/false/null while it's unknown. */
export type DeviceFeatures = {
    relays: number;
    statusLed: boolean;
    light: "rgb" | "dimmer" | null;
    ir: boolean;
    /** Energy meter: calibration. */
    energy: boolean;
    /** Reports the ESP32 internal temperature (SetOption146 1): stored for 24 h and charted. */
    chipTemp: boolean;
};

/** Stored device profile (template, chip, firmware, sensors); refreshed when the device comes online or on demand. */
export type DeviceProfile = {
    template: DeviceTemplate | null;
    chip: string | null;
    firmwareVersion: string | null;
    firmwareBuiltAt: string | null;
    firmwareCore: string | null;
    firmwareSdk: string | null;
    sensors: string[];
    /** Unix time of the last profile change/refresh. */
    profiledAt: number | null;
    features: DeviceFeatures;
};

const emptyProfile: DeviceProfile = {
    template: null,
    chip: null,
    firmwareVersion: null,
    firmwareBuiltAt: null,
    firmwareCore: null,
    firmwareSdk: null,
    sensors: [],
    profiledAt: null,
    features: { relays: 0, statusLed: false, light: null, ir: false, energy: false, chipTemp: false },
};

export default class DeviceEvent {
    public id: number;
    public name: string;
    public topic: string;
    public enabled: boolean;
    public state: DeviceState;
    /** Detected from the profile: energy, co2, t-h, ir or other. */
    public sensorType: string;
    /** Has a relay (from the template) and isn't an IR remote. */
    public supportsToggle: boolean;
    public profile: DeviceProfile;
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
        this.profile = decoded.profile ?? emptyProfile;
        this.offlineTimeout = decoded.offlineTimeout ?? 0;
        this.sensorHistory = decoded.sensorHistory ?? undefined;
        this.storageTiers = decoded.storageTiers ?? [{ step: 300, keep: 0 }];
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

    public isIrRemote(): boolean {
        return this.sensorType === 'ir';
    }

    /** Energy, CO₂ or T-H: has stored sensor data (not IR remotes or unrecognised devices). */
    public hasSensorData(): boolean {
        return this.isEnergySensor() || this.isCo2Sensor() || this.isThSensor();
    }
}
