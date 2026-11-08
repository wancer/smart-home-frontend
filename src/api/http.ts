import DeviceEvent from "./types/device";
import Login from "./types/login";
import SensorEvent from "./types/sensor";
import { CredentialResponse } from '@react-oauth/google';
import SensorDailyEvent from "./types/sensor-daily";
import SensorEventStat from "./types/sensor-event-stat";
import Config from "./types/config";
import Timer from "./types/timer";
import Rule from "./types/rule";
import { IrGroup, IrReceivedCode, IrRule, IrRuleInput, IrSignal, IrSignalInput } from "./types/ir";
import { DeviceNotifications, NotificationRule, NotificationRuleInput, parseDeviceNotifications, parseNotificationRule } from "./types/notification";
import { authSession } from "./auth";

const API_URL = import.meta.env.VITE_API_URL;

export class HttpError extends Error {
    public status: number;
    /** Plain-text body of the error response, when the backend sent one. */
    public detail: string;

    constructor(status: number, detail: string = '') {
        super(`Response status: ${status}`);
        this.status = status;
        this.detail = detail;
    }
}

/**
 * Returned once the session has ended (401, expiry, logout). The request is
 * cancelled rather than rejected: the authorized UI is about to unmount, and a
 * rejection would only make callers flash "request failed" errors or alerts.
 */
function cancelled(): Promise<never> {
    return new Promise<never>(() => {});
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

export default class HttpApi {

    /** Current JWT, or "" when signed out. Used for the WebSocket URL. */
    public get token(): string {
        return authSession.getToken() ?? '';
    }

    /**
     * The single path for authenticated /api/* calls: attaches the Bearer token,
     * ends the session on 401, throws HttpError on any other non-2xx status
     * (except `okStatuses`), and leaves the token alone on 4xx/5xx/network errors.
     */
    private async call<T>(
        method: Method,
        path: string,
        body: unknown,
        parse: (r: Response) => Promise<T>,
        okStatuses: number[] = [],
    ): Promise<T> {
        const token = authSession.getToken(); // also ends the session if exp has passed
        if (token === null) return cancelled();
        const signal = authSession.signal; // tied to the session this request belongs to

        const headers: Record<string, string> = { 'Authorization': 'Bearer ' + token };
        if (body !== undefined) {
            headers['Accept'] = 'application/json';
            headers['Content-Type'] = 'application/json';
        }

        try {
            const response = await fetch(API_URL + path, {
                method,
                headers,
                body: body === undefined ? undefined : JSON.stringify(body),
                signal,
            });
            if (response.status === 401) {
                // end() is idempotent, and a 401 from an older session must not end a newer one.
                if (!signal.aborted) authSession.end('expired');
                return cancelled();
            }
            if (!response.ok && !okStatuses.includes(response.status)) {
                throw new HttpError(response.status, await response.text().catch(() => ''));
            }
            return await parse(response);
        } catch (e) {
            if (signal.aborted) return cancelled();
            throw e;
        }
    }

    private get<T>(path: string): Promise<T> {
        return this.call('GET', path, undefined, r => r.json());
    }

    private sendJson<T>(method: Method, path: string, body: unknown): Promise<T> {
        return this.call(method, path, body, r => r.json());
    }

    private send(method: Method, path: string, body?: unknown): Promise<void> {
        return this.call(method, path, body, async () => {});
    }

    /**
     * Unauthenticated, and deliberately outside call(): a 401/403 here is a final
     * answer (403 = account not allowed), so it is thrown, never treated as expiry.
     */
    public async login(google: CredentialResponse): Promise<Login> {
        const response = await fetch(API_URL + '/api/auth/login', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(google),
        });
        if (!response.ok) {
            throw new HttpError(response.status, await response.text().catch(() => ''));
        }
        return new Login(await response.json());
    }

    public async sensorsMulti(deviceIds: number[]): Promise<Record<number, SensorEvent[]>> {
        try {
            const qs = deviceIds.map(id => `ids=${id}`).join('&');
            const data = await this.get<Record<string, SensorEvent[]>>(`/api/sensors?${qs}`);
            const result: Record<number, SensorEvent[]> = {};
            for (const [key, value] of Object.entries(data)) {
                result[Number(key)] = value;
            }
            return result;
        } catch (e) {
            console.error((e as Error).message);
            return {};
        }
    }

    public sensorsDaily(deviceId: number, from?: string, till?: string): Promise<SensorDailyEvent[]> {
        const params = new URLSearchParams();
        if (from) params.set('from', from);
        if (till) params.set('till', till);
        const qs = params.toString() ? '?' + params.toString() : '';
        return this.get(`/api/devices/${deviceId}/sensors/daily${qs}`);
    }

    public sensorsConfigurable(deviceId: number, duration: string, scale: string, till?: number): Promise<SensorEventStat[]> {
        const qs = till !== undefined ? `?till=${till}` : '';
        return this.get(`/api/devices/${deviceId}/sensors/${duration}/${scale}${qs}`);
    }

    public async devices(): Promise<DeviceEvent[]> {
        // Backend returns a map keyed by device id; the app indexes it like an array.
        const raw = await this.get<Record<string, unknown>>('/api/devices');
        const parsed: Record<string, DeviceEvent> = {};
        for (const key of Object.keys(raw)) parsed[key] = new DeviceEvent(raw[key]);
        return parsed as unknown as DeviceEvent[];
    }

    public device(deviceId: number): Promise<DeviceEvent> {
        return this.get(`/api/devices/${deviceId}`);
    }

    public async createDevice(data: { name: string; topic: string; enabled: boolean; sensorType: string; supportsToggle: boolean }): Promise<DeviceEvent> {
        return new DeviceEvent(await this.sendJson('POST', '/api/devices', data));
    }

    public async updateDevice(deviceId: number, data: { name: string; topic: string; enabled: boolean; sensorType: string; supportsToggle: boolean }): Promise<DeviceEvent> {
        return new DeviceEvent(await this.sendJson('PUT', `/api/devices/${deviceId}`, data));
    }

    public deleteDevice(deviceId: number): Promise<void> {
        return this.send('DELETE', `/api/devices/${deviceId}`);
    }

    public getConfig(deviceId: number): Promise<Config> {
        return this.get(`/api/devices/${deviceId}/control`);
    }

    public async getTimers(deviceId: number): Promise<Timer[]> {
        const parsed = await this.get<unknown[]>(`/api/devices/${deviceId}/timers`);
        return parsed.map(t => new Timer(t));
    }

    public setTimer(deviceId: number, n: number, timer: Timer): Promise<void> {
        return this.send('POST', `/api/devices/${deviceId}/timers/${n}`, {
            enable: timer.enable,
            mode: timer.mode,
            time: timer.time,
            window: timer.window,
            days: timer.days,
            repeat: timer.repeat,
            output: timer.output,
            action: timer.action,
        });
    }

    public getLed(deviceId: number): Promise<{
        ledState: number | null;
        ledPower: boolean | null;
        ledPwmMode: boolean | null;
        ledPwmOn: number | null;
        ledPwmOff: number | null;
    }> {
        return this.get(`/api/devices/${deviceId}/led`);
    }

    public getTiming(deviceId: number): Promise<{
        telePeriod: number | null;
        timezone: string | null;
    }> {
        return this.get(`/api/devices/${deviceId}/timing`);
    }

    public getHardware(deviceId: number): Promise<{
        hardware: string | null;
        firmware: {
            version: string | null;
            buildAt: string | null;
            latestVersion: string | null;
            updateAvailable: boolean;
        };
    }> {
        return this.get(`/api/devices/${deviceId}/hardware`);
    }

    /** Resolves with the HTTP status (200 or 409); throws on other errors. */
    public upgradeFirmware(deviceId: number): Promise<number> {
        return this.call('POST', `/api/devices/${deviceId}/firmware/upgrade`, undefined, async r => r.status, [409]);
    }

    public async getRules(deviceId: number): Promise<Rule[]> {
        const parsed = await this.get<unknown[]>(`/api/devices/${deviceId}/rules`);
        return parsed.map(r => new Rule(r));
    }

    public setRule(deviceId: number, n: number, rule: Rule): Promise<void> {
        return this.send('POST', `/api/devices/${deviceId}/rules/${n}`, {
            rules: rule.rules,
            state: rule.state,
            once: rule.once,
        });
    }

    public wipeSensorData(deviceId: number): Promise<void> {
        return this.send('DELETE', `/api/devices/${deviceId}/sensors`);
    }

    public control(deviceId: number, parameter: string, value: string): Promise<void> {
        return this.send('POST', `/api/devices/${deviceId}/control`, { "deviceId": deviceId, "parameter": parameter, "value": value });
    }

    public irSignals(deviceId: number): Promise<IrGroup[]> {
        return this.get(`/api/devices/${deviceId}/ir`);
    }

    public createIrSignal(deviceId: number, data: IrSignalInput): Promise<IrSignal> {
        return this.sendJson('POST', `/api/devices/${deviceId}/ir`, data);
    }

    public updateIrSignal(deviceId: number, signalId: number, data: IrSignalInput): Promise<IrSignal> {
        return this.sendJson('PUT', `/api/devices/${deviceId}/ir/${signalId}`, data);
    }

    public deleteIrSignal(deviceId: number, signalId: number): Promise<void> {
        return this.send('DELETE', `/api/devices/${deviceId}/ir/${signalId}`);
    }

    public sendIrSignal(deviceId: number, signalId: number): Promise<void> {
        return this.send('POST', `/api/devices/${deviceId}/ir/${signalId}/send`);
    }

    public irRules(deviceId: number): Promise<IrRule[]> {
        return this.get(`/api/devices/${deviceId}/ir/rules`);
    }

    public createIrRule(deviceId: number, data: IrRuleInput): Promise<IrRule> {
        return this.sendJson('POST', `/api/devices/${deviceId}/ir/rules`, data);
    }

    public updateIrRule(deviceId: number, ruleId: number, data: IrRuleInput): Promise<IrRule> {
        return this.sendJson('PUT', `/api/devices/${deviceId}/ir/rules/${ruleId}`, data);
    }

    public deleteIrRule(deviceId: number, ruleId: number): Promise<void> {
        return this.send('DELETE', `/api/devices/${deviceId}/ir/rules/${ruleId}`);
    }

    public irReceived(deviceId: number): Promise<IrReceivedCode[]> {
        return this.get(`/api/devices/${deviceId}/ir/received`);
    }

    public async notifications(deviceId: number): Promise<DeviceNotifications> {
        return parseDeviceNotifications(await this.get<Parameters<typeof parseDeviceNotifications>[0]>(`/api/devices/${deviceId}/notifications`));
    }

    public async createNotification(deviceId: number, data: NotificationRuleInput): Promise<NotificationRule> {
        return parseNotificationRule(await this.sendJson<Parameters<typeof parseNotificationRule>[0]>('POST', `/api/devices/${deviceId}/notifications`, data));
    }

    public async updateNotification(deviceId: number, ruleId: number, data: NotificationRuleInput): Promise<NotificationRule> {
        return parseNotificationRule(await this.sendJson<Parameters<typeof parseNotificationRule>[0]>('PUT', `/api/devices/${deviceId}/notifications/${ruleId}`, data));
    }

    public deleteNotification(deviceId: number, ruleId: number): Promise<void> {
        return this.send('DELETE', `/api/devices/${deviceId}/notifications/${ruleId}`);
    }

    /** 503: Telegram not configured on the server; 502: Telegram rejected the message (detail says why). */
    public testNotification(): Promise<void> {
        return this.send('POST', '/api/notifications/test');
    }
}
