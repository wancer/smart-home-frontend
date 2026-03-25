'use client';

export default class Config {
    public ledState:	number;
    public ledPower:	boolean;
    public telePeriod: number;
    public timezone:	string;
    public ledPwmMode: boolean;
    public ledPwmOff: number;
    public ledPwmOn: number;

    constructor(decoded: any) {
        this.ledState = decoded.ledState;
        this.ledPower = decoded.ledPower;
        this.telePeriod = decoded.telePeriod;
        this.timezone = decoded.timezone;
        this.ledPwmMode = decoded.ledPwmMode;
        this.ledPwmOff = decoded.ledPwmOff;
        this.ledPwmOn = decoded.ledPwmOn;
    }
}