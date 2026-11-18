'use client';

export default class SensorEventStat {
    public time: number;
    public powerConsumed: number | null;
    public powerAvg: number | null;
    public currentAvg: number | null;
    public voltageAvg: number | null;
    public co2Avg: number | null;
    public temperatureAvg: number | null;
    public humidityAvg: number | null;
    // min/max are null for data stored before the backend tracked them
    public powerMin: number | null;
    public powerMax: number | null;
    public co2Min: number | null;
    public co2Max: number | null;
    public temperatureMin: number | null;
    public temperatureMax: number | null;
    public humidityMin: number | null;
    public humidityMax: number | null;
    public chipTemperatureAvg: number | null;

    constructor(decoded: any) {
        this.time = decoded.time;
        this.powerConsumed = decoded.powerConsumed;
        this.powerAvg = decoded.powerAvg;
        this.currentAvg = decoded.currentAvg;
        this.voltageAvg = decoded.voltageAvg;
        this.co2Avg = decoded.co2Avg
        this.temperatureAvg = decoded.temperatureAvg
        this.humidityAvg = decoded.humidityAvg
        this.powerMin = decoded.powerMin ?? null
        this.powerMax = decoded.powerMax ?? null
        this.co2Min = decoded.co2Min ?? null
        this.co2Max = decoded.co2Max ?? null
        this.temperatureMin = decoded.temperatureMin ?? null
        this.temperatureMax = decoded.temperatureMax ?? null
        this.humidityMin = decoded.humidityMin ?? null
        this.humidityMax = decoded.humidityMax ?? null
        this.chipTemperatureAvg = decoded.chipTemperatureAvg ?? null
    }
}
