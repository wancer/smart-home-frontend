'use client';

export default class SensorDailyEvent {
    public date: string;
    public power: number | null; // consumed, W*h

    constructor(decoded: any) {
        this.date = decoded.date;
        this.power = decoded.power;
    }
}
