'use client';

class LedConfig {
    public ledState:	number;
    public ledPower:	boolean;
    public ledPwmMode: boolean;
    public ledPwmOff: number;
    public ledPwmOn: number;

    constructor(decoded: any) {
        this.ledState = decoded.ledState;
        this.ledPower = decoded.ledPower;
        this.ledPwmMode = decoded.ledPwmMode;
        this.ledPwmOff = decoded.ledPwmOff;
        this.ledPwmOn = decoded.ledPwmOn;
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

    constructor(decoded: any) {
        this.telePeriod = decoded.telePeriod;
        this.timezone = decoded.timezone;
        this.firmware = new FirmwareConfig(decoded.firmware);
        this.led = new LedConfig(decoded.led);
    }
}