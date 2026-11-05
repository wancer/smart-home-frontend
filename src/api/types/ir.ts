export interface IrSignal {
    id: number;
    group: string;
    name: string;
    code: string;
    protocol: string;
    bits: number;
}

export interface IrGroup {
    group: string;
    signals: IrSignal[];
}

export interface IrSignalInput {
    group: string;
    name: string;
    code: string;
    protocol?: string;
    bits?: number;
}

export const IR_CODE_REGEX = /^0x[0-9A-Fa-f]{1,16}$/;

export type IrPowerValue = "on" | "off" | "toggle";

export type IrAction =
    | { type: "power"; targetDeviceId: number; value: IrPowerValue }
    | { type: "ir"; signalId: number }
    | { type: "delay"; delayMs: number };

export interface IrRuleInput {
    name: string;
    code: string;
    enabled: boolean;
    actions: IrAction[];
}

export interface IrRule extends IrRuleInput {
    id: number;
}

export interface IrReceivedCode {
    code: string;
    protocol: string;
    bits: number;
    time: number;
}
