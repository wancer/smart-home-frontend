'use client';

class LedConfig {
    public ledState:	number;
    public ledPower:	boolean;
    public ledPwmMode: boolean;
    public ledPwmOff: number;
    public ledPwmOn: number;
    public statusLed: boolean;
    public light: "rgb" | "dimmer" | null;
    public lightPower: boolean | null;
    public dimmer: number | null;
    public color: string | null;

    constructor(decoded: any) {
        this.ledState = decoded.ledState;
        this.ledPower = decoded.ledPower;
        this.ledPwmMode = decoded.ledPwmMode;
        this.ledPwmOff = decoded.ledPwmOff;
        this.ledPwmOn = decoded.ledPwmOn;
        this.statusLed = decoded.statusLed ?? true;
        this.light = decoded.light ?? null;
        this.lightPower = decoded.lightPower ?? null;
        this.dimmer = decoded.dimmer ?? null;
        this.color = decoded.color ?? null;
    }
}

class FirmwareConfig {
    public version: string;
    public buildAt: string;

    constructor(decoded: any) {
        this.version = decoded.version;
        this.buildAt = decoded.buildAt;
    }
}

export default class Config {
    public telePeriod: number;
    public timezone: string;
    public firmware: FirmwareConfig;
    public led: LedConfig;
    public hardware: string | null;

    constructor(decoded: any) {
        this.telePeriod = decoded.telePeriod;
        this.timezone = decoded.timezone;
        this.firmware = new FirmwareConfig(decoded.firmware);
        this.led = new LedConfig(decoded.led);
        this.hardware = decoded.hardware ?? null;
    }
}