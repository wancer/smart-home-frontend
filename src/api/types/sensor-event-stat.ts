import { METRICS, MetricKey } from "../../metrics";

export type StatKind = "Avg" | "Min" | "Max";

/**
 * One chart point. Each metric has <key>Avg/Min/Max fields (e.g. pressureAvg); null = no
 * reading in this step. min/max are also null for data stored before the backend tracked them.
 */
export default class SensorEventStat {
    public time: number;
    public powerConsumed: number | null;
    public chipTemperatureAvg: number | null;

    public powerAvg!: number | null;
    public powerMin!: number | null;
    public powerMax!: number | null;
    public currentAvg!: number | null;
    public currentMin!: number | null;
    public currentMax!: number | null;
    public voltageAvg!: number | null;
    public voltageMin!: number | null;
    public voltageMax!: number | null;
    public temperatureAvg!: number | null;
    public temperatureMin!: number | null;
    public temperatureMax!: number | null;
    public humidityAvg!: number | null;
    public humidityMin!: number | null;
    public humidityMax!: number | null;
    public co2Avg!: number | null;
    public co2Min!: number | null;
    public co2Max!: number | null;
    public pressureAvg!: number | null;
    public pressureMin!: number | null;
    public pressureMax!: number | null;
    public dcPowerAvg!: number | null;
    public dcPowerMin!: number | null;
    public dcPowerMax!: number | null;
    public dcCurrentAvg!: number | null;
    public dcCurrentMin!: number | null;
    public dcCurrentMax!: number | null;
    public dcVoltageAvg!: number | null;
    public dcVoltageMin!: number | null;
    public dcVoltageMax!: number | null;

    constructor(decoded: any) {
        this.time = decoded.time;
        this.powerConsumed = decoded.powerConsumed ?? null;
        this.chipTemperatureAvg = decoded.chipTemperatureAvg ?? null;
        const self = this as unknown as Record<string, number | null>;
        for (const m of METRICS) {
            for (const kind of ["Avg", "Min", "Max"] as StatKind[]) {
                const field = m.key + kind;
                self[field] = typeof decoded[field] === "number" ? decoded[field] : null;
            }
        }
    }

    public get(key: MetricKey, kind: StatKind): number | null {
        return (this as unknown as Record<string, number | null>)[key + kind];
    }
}
