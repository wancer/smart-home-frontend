'use client';

export default class SensorEventStat {
    public time: number;
    public powerConsumed: number | null;
    public powerAvg: number | null;
    public currentAvg: number | null;
    public voltageAvg: number | null;
    public co2eAvg: number | null;
    public temperatureAvg: number | null;
    public humidityAvg: number | null;

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
