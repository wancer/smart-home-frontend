'use client';

class DeviceState {
    public on: boolean;
	public last: number;
	public power: number;
    public current: number;
    public voltage: number;

    constructor(decoded: any) {
        this.on = decoded.on;
        this.last = decoded.last;
        this.power = decoded.power;
        this.current = decoded.current;
        this.voltage = decoded.voltage;
    }
}

export default class DeviceEvent {
    public id: number;
    public name: string;
    public state: DeviceState;
    
    constructor(decoded: any) {
        this.id = decoded.id;
        this.name = decoded.name;
        this.state = new DeviceState(decoded.state)
    }
}
