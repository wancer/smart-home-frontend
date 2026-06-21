export default class Timer {
    public n: number;
    public enable: number;
    public mode: number;
    public time: string;
    public window: number;
    public days: string;
    public repeat: number;
    public output: number;
    public action: number;

    constructor(decoded: any) {
        this.n = decoded.n;
        this.enable = decoded.enable ?? 0;
        this.mode = decoded.mode ?? 0;
        this.time = decoded.time ?? "00:00";
        this.window = decoded.window ?? 0;
        this.days = decoded.days ?? "0000000";
        this.repeat = decoded.repeat ?? 0;
        this.output = decoded.output ?? 1;
        this.action = decoded.action ?? 0;
    }
}
