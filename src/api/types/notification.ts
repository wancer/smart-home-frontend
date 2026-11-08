export type NotificationKind = "offline" | "online" | "above" | "below";

export const NOTIFICATION_KINDS: NotificationKind[] = ["offline", "online", "above", "below"];

export const THRESHOLD_KINDS: NotificationKind[] = ["above", "below"];

export const METRIC_UNITS: Record<string, string> = {
    power: "W",
    current: "A",
    voltage: "V",
    co2: "ppm",
    temperature: "°C",
    humidity: "%",
};

/** Upper bounds enforced by the backend. */
export const MAX_DURATION_SEC = 604800;
export const MAX_MESSAGE_LENGTH = 255;

export interface NotificationRuleInput {
    kind: NotificationKind;
    metric: string;
    threshold: number;
    /** Seconds. */
    duration: number;
    notifyRecovery: boolean;
    message: string;
    enabled: boolean;
}

export interface NotificationRule extends NotificationRuleInput {
    id: number;
    active: boolean;
}

export interface DeviceNotifications {
    telegramConfigured: boolean;
    metrics: string[];
    rules: NotificationRule[];
}

type RawRule = Partial<NotificationRule> & Pick<NotificationRule, "id" | "kind">;

/** The backend omits empty / zero / false fields; fill them back in. */
export function parseNotificationRule(raw: RawRule): NotificationRule {
    return {
        id: raw.id,
        kind: raw.kind,
        metric: raw.metric ?? "",
        threshold: raw.threshold ?? 0,
        duration: raw.duration ?? 0,
        notifyRecovery: raw.notifyRecovery ?? false,
        message: raw.message ?? "",
        enabled: raw.enabled ?? false,
        active: raw.active ?? false,
    };
}

export function parseDeviceNotifications(raw: { telegramConfigured?: boolean; metrics?: string[]; rules?: RawRule[] }): DeviceNotifications {
    return {
        telegramConfigured: raw.telegramConfigured ?? false,
        metrics: raw.metrics ?? [],
        rules: (raw.rules ?? []).map(parseNotificationRule),
    };
}
