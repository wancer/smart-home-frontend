'use client';

class DeviceState {
    public on: boolean|null;
	public last: number;

	public power: number;
    public current: number;
    public voltage: number;

    public co2: number;
    public co2e: number;
    public temperature: number;
    public humidity: number;

    constructor(decoded: any) {
        this.on = decoded.on;
        this.last = decoded.last;

        this.power = decoded.power;
        this.current = decoded.current;
        this.voltage = decoded.voltage;

        this.co2 = decoded.co2;
        this.co2e = decoded.co2e;
        this.temperature = decoded.temperature;
        this.humidity = decoded.humidity;
    }
}

export default class DeviceEvent {
    public id: number;
    public name: string;
    public topic: string;
    public enabled: boolean;
    public state: DeviceState;
    public sensorType: string;
    public supportsToggle: boolean;

    constructor(decoded: any) {
        this.id = decoded.id;
        this.name = decoded.name;
        this.topic = decoded.topic ?? '';
        this.enabled = decoded.enabled ?? true;
        this.state = new DeviceState(decoded.state)
        this.sensorType = decoded.sensorType;
        this.supportsToggle = decoded.supportsToggle;
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
}
