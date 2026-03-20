'use client';

export default class Device {
    public id: number;
    public name: string;
    
    constructor(decoded: any) {
        this.id = decoded.id;
        this.name = decoded.name;
    }
}
