'use client';

export default class Record {
    public DeviceId: number;
    public DeviceTime: number;
    public Period: number;
    public Power: number;
    public Current: number;

    constructor(decoded: any) {
        this.DeviceId = decoded.DeviceId;
        this.DeviceTime = decoded.DeviceTime;
        this.Period = decoded.Period;
        this.Power = decoded.Power;
        this.Current = decoded.Current;
    }
}
