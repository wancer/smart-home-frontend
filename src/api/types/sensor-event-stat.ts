'use client';

export default class SensorEventStat {
    public time: string;
    public powerConsumed: number;
    public powerAvg: number;
    public currentAvg: number;
    public voltageAvg: number;

    constructor(decoded: any) {
        this.time = decoded.time;
        this.powerConsumed = decoded.powerConsumed;
        this.powerAvg = decoded.powerAvg;
        this.currentAvg = decoded.currentAvg;
        this.voltageAvg = decoded.voltageAvg;
    }
}
