'use client';

export default class SensorEventStat {
    public time: string;
    public powerConsumed: number;
    public powerAvg: number;
    public currentAvg: number;
    public voltageAvg: number;
    public co2eAvg: number;
    public temperatureAvg: number;
    public humidityAvg: number;

    constructor(decoded: any) {
        this.time = decoded.time;
        this.powerConsumed = decoded.powerConsumed;
        this.powerAvg = decoded.powerAvg;
        this.currentAvg = decoded.currentAvg;
        this.voltageAvg = decoded.voltageAvg;
        this.co2eAvg = decoded.co2eAvg
        this.temperatureAvg = decoded.temperatureAvg
        this.humidityAvg = decoded.humidityAvg
    }
}
