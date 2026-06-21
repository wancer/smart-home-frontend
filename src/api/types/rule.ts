'use client';

export default class Rule {
    public n: number;
    public state: number;
    public once: number;
    public rules: string;
    public free: number;

    constructor(decoded: any) {
        this.n = decoded.n;
        this.state = decoded.state ?? 0;
        this.once = decoded.once ?? 0;
        this.rules = decoded.rules ?? '';
        this.free = decoded.free ?? 0;
    }
}
