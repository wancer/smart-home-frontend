"use client";

import { useEffect, useState } from "react";
import { Button, Form, InputGroup, Modal } from "react-bootstrap";
import { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import HttpApi, { HttpError } from "../api/http";
import DeviceEvent from "../api/types/device";
import {
  DeviceNotifications,
  MAX_DURATION_SEC,
  MAX_MESSAGE_LENGTH,
  METRIC_UNITS,
  NOTIFICATION_KINDS,
  NotificationKind,
  NotificationRule,
  NotificationRuleInput,
  THRESHOLD_KINDS,
} from "../api/types/notification";
import { useToasts } from "./use-toasts";

type Props = { api: HttpApi; device: DeviceEvent };

const usesThreshold = (k: NotificationKind) => THRESHOLD_KINDS.includes(k);

function describeError(e: unknown, fallback: string): string {
  if (e instanceof HttpError && e.detail.trim()) return e.detail.trim();
  return fallback;
}

function metricLabel(t: TFunction, metric: string): string {
  return t("notifications.metric_" + metric, { defaultValue: metric });
}

function withUnit(metric: string, value: number): string {
  const unit = METRIC_UNITS[metric];
  if (!unit) return String(value);
  return unit === "%" || unit === "°C" ? `${value}${unit}` : `${value} ${unit}`;
}

function formatDuration(t: TFunction, sec: number): string {
  if (sec % 86400 === 0) return t("notifications.durDay", { n: sec / 86400 });
  if (sec % 3600 === 0) return t("notifications.durHour", { n: sec / 3600 });
  if (sec % 60 === 0) return t("notifications.durMin", { n: sec / 60 });
  return t("notifications.durSec", { n: sec });
}

function summarizeRule(t: TFunction, r: NotificationRuleInput): string {
  const timed = r.duration > 0;
  const d = timed ? formatDuration(t, r.duration) : "";
  switch (r.kind) {
    case "offline":
      return timed ? t("notifications.sumOfflineFor", { d }) : t("notifications.sumOffline");
    case "online":
      return timed ? t("notifications.sumOnlineAfter", { d }) : t("notifications.sumOnline");
    case "above":
    case "below": {
      const params = { metric: metricLabel(t, r.metric), value: withUnit(r.metric, r.threshold), d };
      const key = r.kind === "above" ? "sumAbove" : "sumBelow";
      return t(`notifications.${key}${timed ? "For" : ""}`, params);
    }
    default:
      return r.kind;
  }
}

const toInput = (r: NotificationRule): NotificationRuleInput => ({
  kind: r.kind,
  metric: r.metric,
  threshold: r.threshold,
  duration: r.duration,
  notifyRecovery: r.notifyRecovery,
  message: r.message,
  enabled: r.enabled,
});

// ---- section -------------------------------------------------------------

// Mount with key={device.id} so state resets on device change.
export default function NotificationRules({ api, device }: Props) {
  const { t } = useTranslation();
  const { toast, toastNode } = useToasts();
  const deviceId = device.id;

  const [data, setData] = useState<DeviceNotifications | undefined>(undefined);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState<Set<number>>(new Set());
  const [testing, setTesting] = useState(false);
  const [editor, setEditor] = useState<{ rule: NotificationRule | null } | null>(null);

  const fetchData = (isCancelled: () => boolean = () => false) =>
    api.notifications(deviceId)
      .then(d => { if (!isCancelled()) setData(d); })
      .catch(e => { console.error((e as Error).message); if (!isCancelled()) setLoadError(true); });

  useEffect(() => {
    let cancelled = false;
    fetchData(() => cancelled);
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, deviceId]);

  const retry = () => { setLoadError(false); fetchData(); };

  const replaceRule = (rule: NotificationRule) =>
    setData(prev => prev && ({ ...prev, rules: prev.rules.map(r => (r.id === rule.id ? rule : r)) }));

  const toggleEnabled = async (r: NotificationRule) => {
    if (busy.has(r.id)) return;
    setBusy(prev => new Set(prev).add(r.id));
    try {
      replaceRule(await api.updateNotification(deviceId, r.id, { ...toInput(r), enabled: !r.enabled }));
    } catch (e) {
      console.error((e as Error).message);
      toast(describeError(e, t("notifications.toggleFailed")), "danger");
    } finally {
      setBusy(prev => { const n = new Set(prev); n.delete(r.id); return n; });
    }
  };

  const remove = async (r: NotificationRule) => {
    if (!confirm(t("notifications.deleteConfirm", { name: summarizeRule(t, r) }))) return;
    try {
      await api.deleteNotification(deviceId, r.id);
      setData(prev => prev && ({ ...prev, rules: prev.rules.filter(x => x.id !== r.id) }));
    } catch (e) {
      console.error((e as Error).message);
      toast(describeError(e, t("notifications.deleteFailed")), "danger");
    }
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      await api.testNotification();
      toast(t("notifications.testSent"), "success");
    } catch (e) {
      console.error((e as Error).message);
      if (e instanceof HttpError && e.status === 503) {
        setData(prev => prev && ({ ...prev, telegramConfigured: false }));
        toast(t("notifications.testNotConfigured"), "danger");
      } else if (e instanceof HttpError && e.status === 502) {
        toast(describeError(e, t("notifications.testRejected")), "danger");
      } else {
        toast(t("notifications.testFailed"), "danger");
      }
    } finally {
      setTesting(false);
    }
  };

  const onSaved = (rule: NotificationRule, created: boolean) => {
    setEditor(null);
    if (created) setData(prev => prev && ({ ...prev, rules: [...prev.rules, rule] }));
    else replaceRule(rule);
  };

  return (
    <div className="mt-4">
      <div className="d-flex flex-wrap justify-content-between align-items-center my-3 gap-2">
        <h4 className="m-0">
          <i className="fa-solid fa-bell me-2"></i>{t("notifications.title")}
        </h4>
        <div className="d-flex gap-2">
          <Button variant="outline-secondary" disabled={testing} onClick={sendTest}>
            {testing
              ? <span className="spinner-border spinner-border-sm me-1" role="status"></span>
              : <i className="fa-solid fa-paper-plane me-1"></i>}
            {t("notifications.test")}
          </Button>
          <Button variant="primary" disabled={!data} onClick={() => setEditor({ rule: null })}>
            <i className="fa-solid fa-plus me-1"></i>{t("notifications.add")}
          </Button>
        </div>
      </div>

      {data && !data.telegramConfigured && (
        <div className="alert alert-warning">
          <i className="fa-solid fa-triangle-exclamation me-2"></i>
          {t("notifications.notConfiguredPre")} <code>TELEGRAM_BOT_TOKEN</code> {t("notifications.and")} <code>TELEGRAM_CHAT_ID</code> {t("notifications.notConfiguredPost")}
        </div>
      )}

      {!data && !loadError && (
        <div className="text-center py-5">
          <div className="spinner-border" role="status"><span className="visually-hidden">{t("app.loading")}</span></div>
        </div>
      )}

      {loadError && (
        <div className="alert alert-danger d-flex justify-content-between align-items-center">
          <span>{t("notifications.loadError")}</span>
          <Button variant="outline-danger" size="sm" onClick={retry}>{t("notifications.retry")}</Button>
        </div>
      )}

      {data && data.rules.length === 0 && <div className="text-center text-muted py-4">{t("notifications.empty")}</div>}

      {data && data.rules.map(r => (
        <div key={r.id} className={"card mb-3" + (r.enabled ? "" : " opacity-75")}>
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-start gap-2">
              <div className="min-w-0">
                <div className="fw-bold">
                  {summarizeRule(t, r)}
                  {r.active && (
                    <span className="badge text-bg-danger ms-2 align-middle" title={t("notifications.activeHint")}>
                      {t("notifications.active")}
                    </span>
                  )}
                </div>
                {usesThreshold(r.kind) && r.notifyRecovery && (
                  <div className="small text-muted">
                    <i className="fa-solid fa-rotate-left me-1"></i>{t("notifications.notifiesRecovery")}
                  </div>
                )}
                {r.message && (
                  <div className="small text-muted text-break">
                    <i className="fa-regular fa-message me-1"></i>{r.message}
                  </div>
                )}
              </div>
              <Form.Check
                type="switch"
                id={`notification-enabled-${r.id}`}
                className="fs-4"
                aria-label={t("notifications.enabled")}
                checked={r.enabled}
                disabled={busy.has(r.id)}
                onChange={() => toggleEnabled(r)}
              />
            </div>
            <div className="d-flex gap-2 mt-3">
              <Button variant="outline-secondary" onClick={() => setEditor({ rule: r })} aria-label={t("notifications.edit")}>
                <i className="fa-solid fa-pen"></i>
              </Button>
              <Button variant="outline-danger" onClick={() => remove(r)} aria-label={t("notifications.remove")}>
                <i className="fa-solid fa-trash"></i>
              </Button>
            </div>
          </div>
        </div>
      ))}

      {editor && data && (
        <RuleEditor
          api={api}
          deviceId={deviceId}
          rule={editor.rule}
          metrics={data.metrics}
          onClose={() => setEditor(null)}
          onSaved={onSaved}
        />
      )}
      {toastNode}
    </div>
  );
}

// ---- editor --------------------------------------------------------------

type Preset = { key: string; input: Omit<NotificationRuleInput, "enabled" | "message"> };

const PRESETS: Preset[] = [
  { key: "presetOffline", input: { kind: "offline", metric: "", threshold: 0, duration: 300, notifyRecovery: false } },
  { key: "presetOnline", input: { kind: "online", metric: "", threshold: 0, duration: 0, notifyRecovery: false } },
  { key: "presetCo2", input: { kind: "above", metric: "co2", threshold: 1000, duration: 0, notifyRecovery: true } },
  { key: "presetHumidity", input: { kind: "above", metric: "humidity", threshold: 70, duration: 0, notifyRecovery: true } },
  { key: "presetApplianceDone", input: { kind: "below", metric: "power", threshold: 5, duration: 300, notifyRecovery: false } },
];

type Draft = {
  kind: NotificationKind;
  metric: string;
  threshold: string;
  durationMin: string;
  notifyRecovery: boolean;
  message: string;
  enabled: boolean;
};

function toDraft(r: NotificationRuleInput): Draft {
  return {
    kind: r.kind,
    metric: r.metric,
    threshold: String(r.threshold),
    durationMin: String(+(r.duration / 60).toFixed(2)),
    notifyRecovery: r.notifyRecovery,
    message: r.message,
    enabled: r.enabled,
  };
}

function durationSec(d: Draft): number | null {
  if (d.durationMin.trim() === "") return null;
  const min = Number(d.durationMin);
  if (!isFinite(min)) return null;
  const sec = Math.round(min * 60);
  return sec >= 0 && sec <= MAX_DURATION_SEC ? sec : null;
}

function thresholdValue(d: Draft): number | null {
  if (d.threshold.trim() === "") return null;
  const v = Number(d.threshold);
  return isFinite(v) ? v : null;
}

type EditorProps = {
  api: HttpApi;
  deviceId: number;
  rule: NotificationRule | null;
  metrics: string[];
  onClose: () => void;
  onSaved: (rule: NotificationRule, created: boolean) => void;
};

function RuleEditor({ api, deviceId, rule, metrics, onClose, onSaved }: EditorProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<Draft>(() =>
    rule
      ? toDraft(rule)
      : { kind: "offline", metric: "", threshold: "", durationMin: "0", notifyRecovery: false, message: "", enabled: true });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const patch = (p: Partial<Draft>) => setDraft(prev => ({ ...prev, ...p }));

  const hasMetrics = metrics.length > 0;
  // Keep the rule's current kind/metric selectable even if the device no longer reports it.
  const kinds = NOTIFICATION_KINDS.filter(k => !usesThreshold(k) || hasMetrics || k === rule?.kind);
  const metricOptions = draft.metric && !metrics.includes(draft.metric) ? [draft.metric, ...metrics] : metrics;
  const presets = rule ? [] : PRESETS.filter(p => !p.input.metric || metrics.includes(p.input.metric));

  const changeKind = (kind: NotificationKind) =>
    patch(usesThreshold(kind) && !draft.metric ? { kind, metric: metrics[0] ?? "" } : { kind });

  const applyPreset = (p: Preset) =>
    setDraft(prev => ({ ...toDraft({ ...p.input, message: prev.message, enabled: prev.enabled }) }));

  const threshold = usesThreshold(draft.kind);
  const dur = durationSec(draft);
  const thr = thresholdValue(draft);
  const valid =
    dur !== null &&
    draft.message.length <= MAX_MESSAGE_LENGTH &&
    (!threshold || (draft.metric !== "" && thr !== null));

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    setError(null);
    const input: NotificationRuleInput = {
      kind: draft.kind,
      metric: threshold ? draft.metric : "",
      threshold: threshold ? (thr as number) : 0,
      duration: dur as number,
      notifyRecovery: threshold && draft.notifyRecovery,
      message: draft.message.trim(),
      enabled: draft.enabled,
    };
    try {
      const saved = rule
        ? await api.updateNotification(deviceId, rule.id, input)
        : await api.createNotification(deviceId, input);
      onSaved(saved, !rule);
    } catch (e) {
      console.error((e as Error).message);
      setError(describeError(e, t("notifications.saveFailed")));
      setSaving(false);
    }
  };

  return (
    <Modal show onHide={onClose} fullscreen="sm-down" scrollable>
      <Modal.Header closeButton>
        <Modal.Title>{rule ? t("notifications.edit") : t("notifications.add")}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <div className="alert alert-danger" style={{ whiteSpace: "pre-wrap" }}>{error}</div>}

        {presets.length > 0 && (
          <div className="mb-3">
            <Form.Label>{t("notifications.presets")}</Form.Label>
            <div className="d-flex flex-wrap gap-2">
              {presets.map(p => (
                <Button key={p.key} variant="outline-primary" size="sm" onClick={() => applyPreset(p)}>
                  {t("notifications." + p.key)}
                </Button>
              ))}
            </div>
          </div>
        )}

        <Form.Group className="mb-3">
          <Form.Label>{t("notifications.kind")}</Form.Label>
          <Form.Select size="lg" value={draft.kind} onChange={e => changeKind(e.target.value as NotificationKind)}>
            {kinds.map(k => <option key={k} value={k}>{t("notifications.kind_" + k)}</option>)}
          </Form.Select>
        </Form.Group>

        {threshold && (
          <>
            <Form.Group className="mb-3">
              <Form.Label>{t("notifications.metric")}</Form.Label>
              <Form.Select
                value={draft.metric}
                isInvalid={draft.metric === ""}
                onChange={e => patch({ metric: e.target.value })}
              >
                {draft.metric === "" && <option value="">{t("notifications.pickMetric")}</option>}
                {metricOptions.map(m => <option key={m} value={m}>{metricLabel(t, m)}</option>)}
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>{t("notifications.threshold")}</Form.Label>
              <InputGroup>
                <Form.Control
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={draft.threshold}
                  isInvalid={draft.threshold !== "" && thr === null}
                  onChange={e => patch({ threshold: e.target.value })}
                />
                {METRIC_UNITS[draft.metric] && <InputGroup.Text>{METRIC_UNITS[draft.metric]}</InputGroup.Text>}
              </InputGroup>
            </Form.Group>
          </>
        )}

        <Form.Group className="mb-3">
          <Form.Label>{t(draft.kind === "online" ? "notifications.durationOnline" : "notifications.duration")}</Form.Label>
          <InputGroup>
            <Form.Control
              type="number"
              inputMode="decimal"
              min={0}
              max={MAX_DURATION_SEC / 60}
              step="any"
              value={draft.durationMin}
              isInvalid={dur === null}
              onChange={e => patch({ durationMin: e.target.value })}
            />
            <InputGroup.Text>{t("notifications.minutes")}</InputGroup.Text>
          </InputGroup>
          <Form.Text>{t("notifications.durationHint")}</Form.Text>
        </Form.Group>

        {threshold && (
          <Form.Check
            className="mb-3"
            type="checkbox"
            id="notification-editor-recovery"
            label={t("notifications.notifyRecovery")}
            checked={draft.notifyRecovery}
            onChange={e => patch({ notifyRecovery: e.target.checked })}
          />
        )}

        <Form.Group className="mb-3">
          <Form.Label>{t("notifications.message")}</Form.Label>
          <Form.Control
            value={draft.message}
            maxLength={MAX_MESSAGE_LENGTH}
            placeholder={t("notifications.messagePlaceholder")}
            onChange={e => patch({ message: e.target.value })}
          />
          <Form.Text>{t("notifications.messageHint")} ({draft.message.length}/{MAX_MESSAGE_LENGTH})</Form.Text>
        </Form.Group>

        <Form.Check
          type="switch"
          id="notification-editor-enabled"
          label={t("notifications.enabled")}
          checked={draft.enabled}
          onChange={e => patch({ enabled: e.target.checked })}
        />

        {valid && (
          <div className="text-muted small mt-3">
            <i className="fa-solid fa-eye me-1"></i>
            {summarizeRule(t, {
              kind: draft.kind, metric: draft.metric, threshold: thr ?? 0, duration: dur ?? 0,
              notifyRecovery: draft.notifyRecovery, message: draft.message, enabled: draft.enabled,
            })}
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>{t("notifications.cancel")}</Button>
        <Button variant="primary" onClick={save} disabled={!valid || saving}>
          {saving ? t("notifications.saving") : t("notifications.save")}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
