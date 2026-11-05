"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, ButtonGroup, Form, Modal } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import HttpApi, { HttpError } from "../api/http";
import DeviceEvent from "../api/types/device";
import { IR_CODE_REGEX, IrAction, IrGroup, IrPowerValue, IrReceivedCode, IrRule, IrRuleInput } from "../api/types/ir";
import { useToasts } from "./use-toasts";

type Props = { api: HttpApi; device: DeviceEvent; devices: DeviceEvent[] };

type SignalInfo = { id: number; group: string; name: string; code: string; owner: DeviceEvent };

type Catalog = {
  powerTargets: DeviceEvent[];
  signals: SignalInfo[];
  multipleIrDevices: boolean;
};

const MAX_ACTIONS = 20;
const normCode = (c: string) => "0x" + c.trim().slice(2).toUpperCase();

function signalLabel(s: SignalInfo, multi: boolean) {
  return (multi ? `${s.owner.name} · ` : "") + `${s.group} → ${s.name}`;
}

function describeError(e: unknown, fallback: string): string {
  if (e instanceof HttpError && e.detail.trim()) return e.detail.trim();
  return fallback;
}

// ---- rule list -----------------------------------------------------------

export default function IrRules({ api, device, devices }: Props) {
  const { t } = useTranslation();
  const { toast, toastNode } = useToasts();
  const deviceId = device.id;

  const [rules, setRules] = useState<IrRule[] | undefined>(undefined);
  const [catalog, setCatalog] = useState<Catalog | undefined>(undefined);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState<Set<number>>(new Set());
  const [editor, setEditor] = useState<{ rule: IrRule | null } | null>(null);

  // `devices` is replaced on every websocket update; only refetch when ids/names/types change.
  const deviceList = Object.values(devices) as DeviceEvent[];
  const devicesKey = JSON.stringify(deviceList.map(d => [d.id, d.name, d.sensorType]));
  const deviceListRef = useRef(deviceList);
  useEffect(() => { deviceListRef.current = deviceList; });

  const loadRules = useCallback(async () => {
    setRules(await api.irRules(deviceId));
  }, [api, deviceId]);

  // Signals of every IR device + power targets; rebuilt when the device list changes.
  const loadCatalog = useCallback(async (): Promise<Catalog> => {
    const deviceList = deviceListRef.current;
    const irDevices = deviceList.filter(d => d.isIrRemote());
    const perDevice = await Promise.all(irDevices.map(async d => ({ d, groups: await api.irSignals(d.id) as IrGroup[] })));
    const signals: SignalInfo[] = perDevice.flatMap(({ d, groups }) =>
      groups.flatMap(g => g.signals.map(s => ({ id: s.id, group: g.group, name: s.name, code: normCode(s.code), owner: d }))));
    return { powerTargets: deviceList.filter(d => !d.isIrRemote()), signals, multipleIrDevices: irDevices.length > 1 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, devicesKey]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.irRules(deviceId), loadCatalog()])
      .then(([r, c]) => { if (!cancelled) { setRules(r); setCatalog(c); } })
      .catch(e => { console.error((e as Error).message); if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, [api, deviceId, loadCatalog]);

  const retry = () => {
    setLoadError(false);
    Promise.all([api.irRules(deviceId), loadCatalog()])
      .then(([r, c]) => { setRules(r); setCatalog(c); })
      .catch(e => { console.error((e as Error).message); setLoadError(true); });
  };

  const toInput = (r: IrRule): IrRuleInput => ({ name: r.name, code: r.code, enabled: r.enabled, actions: r.actions });

  const toggleEnabled = async (r: IrRule) => {
    if (busy.has(r.id)) return;
    setBusy(prev => new Set(prev).add(r.id));
    try {
      await api.updateIrRule(deviceId, r.id, { ...toInput(r), enabled: !r.enabled });
      await loadRules();
    } catch (e) {
      console.error((e as Error).message);
      toast(describeError(e, t("irRules.toggleFailed")), "danger");
    } finally {
      setBusy(prev => { const n = new Set(prev); n.delete(r.id); return n; });
    }
  };

  const remove = async (r: IrRule) => {
    if (!confirm(t("irRules.deleteConfirm", { name: r.name }))) return;
    try {
      await api.deleteIrRule(deviceId, r.id);
      await loadRules();
    } catch (e) {
      console.error((e as Error).message);
      toast(describeError(e, t("irRules.deleteFailed")), "danger");
    }
  };

  const summarize = (a: IrAction): { text: string; missing: boolean } => {
    if (a.type === "delay") return { text: t("irRules.waitSummary", { s: a.delayMs / 1000 }), missing: false };
    if (!catalog) return { text: "…", missing: false };
    if (a.type === "power") {
      const target = catalog.powerTargets.find(d => d.id === a.targetDeviceId);
      return target
        ? { text: `${target.name} ${t("irRules." + a.value)}`, missing: false }
        : { text: `${t("irRules.missing")} #${a.targetDeviceId}`, missing: true };
    }
    const sig = catalog.signals.find(s => s.id === a.signalId);
    return sig
      ? { text: signalLabel(sig, catalog.multipleIrDevices), missing: false }
      : { text: `${t("irRules.missing")} #${a.signalId}`, missing: true };
  };

  const ready = rules !== undefined && catalog !== undefined;

  return (
    <>
      <div className="d-flex justify-content-between align-items-center my-3 gap-2">
        <h4 className="m-0">{t("irRules.title")}</h4>
        <Button variant="primary" disabled={!ready} onClick={() => setEditor({ rule: null })}>
          <i className="fa-solid fa-plus me-1"></i>{t("irRules.add")}
        </Button>
      </div>

      {!ready && !loadError && (
        <div className="text-center py-5">
          <div className="spinner-border" role="status"><span className="visually-hidden">{t("app.loading")}</span></div>
        </div>
      )}

      {loadError && (
        <div className="alert alert-danger d-flex justify-content-between align-items-center">
          <span>{t("irRules.loadError")}</span>
          <Button variant="outline-danger" size="sm" onClick={retry}>{t("irRules.retry")}</Button>
        </div>
      )}

      {ready && !loadError && rules.length === 0 && <div className="text-center text-muted py-5">{t("irRules.empty")}</div>}

      {ready && !loadError && rules.map(r => (
        <div key={r.id} className={"card mb-3" + (r.enabled ? "" : " opacity-75")}>
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-start gap-2">
              <div className="min-w-0">
                <div className="fw-bold">{r.name}</div>
                <code>{r.code}</code>
              </div>
              <Form.Check
                type="switch"
                id={`rule-enabled-${r.id}`}
                className="fs-4"
                aria-label={t("irRules.enabled")}
                checked={r.enabled}
                disabled={busy.has(r.id)}
                onChange={() => toggleEnabled(r)}
              />
            </div>
            <div className="mt-2 small">
              {r.actions.map((a, i) => {
                const s = summarize(a);
                return (
                  <span key={i}>
                    {i > 0 && <span className="text-muted"> → </span>}
                    <span className={s.missing ? "text-warning fw-bold" : ""}>
                      {s.missing && <i className="fa-solid fa-triangle-exclamation me-1"></i>}{s.text}
                    </span>
                  </span>
                );
              })}
            </div>
            <div className="d-flex gap-2 mt-3">
              <Button variant="outline-secondary" onClick={() => setEditor({ rule: r })} aria-label={t("irRules.edit")}>
                <i className="fa-solid fa-pen"></i>
              </Button>
              <Button variant="outline-danger" onClick={() => remove(r)} aria-label={t("irRules.remove")}>
                <i className="fa-solid fa-trash"></i>
              </Button>
            </div>
          </div>
        </div>
      ))}

      {editor && catalog && (
        <RuleEditor
          api={api}
          deviceId={deviceId}
          rule={editor.rule}
          catalog={catalog}
          onClose={() => setEditor(null)}
          onSaved={async () => { setEditor(null); try { await loadRules(); } catch (e) { toast(describeError(e, t("irRules.loadError")), "danger"); } }}
        />
      )}
      {toastNode}
    </>
  );
}

// ---- editor --------------------------------------------------------------

type Draft = {
  key: number;
  type: IrAction["type"];
  targetDeviceId: number | null;
  value: IrPowerValue;
  signalId: number | null;
  delaySec: string;
};

let draftSeq = 0;

function toDraft(a: IrAction | null): Draft {
  const base: Draft = { key: ++draftSeq, type: "power", targetDeviceId: null, value: "on", signalId: null, delaySec: "1" };
  if (!a) return base;
  if (a.type === "power") return { ...base, type: "power", targetDeviceId: a.targetDeviceId, value: a.value };
  if (a.type === "ir") return { ...base, type: "ir", signalId: a.signalId };
  return { ...base, type: "delay", delaySec: String(a.delayMs / 1000) };
}

function delayMs(d: Draft): number | null {
  const sec = Number(d.delaySec);
  if (d.delaySec.trim() === "" || !isFinite(sec)) return null;
  const ms = Math.round(sec * 1000);
  return ms >= 100 && ms <= 60000 ? ms : null;
}

function fromDraft(d: Draft): IrAction | null {
  if (d.type === "power") return d.targetDeviceId === null ? null : { type: "power", targetDeviceId: d.targetDeviceId, value: d.value };
  if (d.type === "ir") return d.signalId === null ? null : { type: "ir", signalId: d.signalId };
  const ms = delayMs(d);
  return ms === null ? null : { type: "delay", delayMs: ms };
}

type EditorProps = {
  api: HttpApi;
  deviceId: number;
  rule: IrRule | null;
  catalog: Catalog;
  onClose: () => void;
  onSaved: () => void;
};

function RuleEditor({ api, deviceId, rule, catalog, onClose, onSaved }: EditorProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(rule?.name ?? "");
  const [code, setCode] = useState(rule?.code ?? "");
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);
  const [drafts, setDrafts] = useState<Draft[]>(() => (rule?.actions ?? []).map(toDraft));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Learn: poll received codes; baseline = codes already present when Learn starts.
  const [learning, setLearning] = useState(false);
  const [baseline, setBaseline] = useState<Set<string>>(new Set());
  const [received, setReceived] = useState<IrReceivedCode[]>([]);
  const [now, setNow] = useState(0);
  const [learnError, setLearnError] = useState(false);

  const codeKey = (c: IrReceivedCode) => `${c.code}|${c.time}`;

  const startLearn = async () => {
    setLearnError(false);
    try {
      const current = await api.irReceived(deviceId);
      setBaseline(new Set(current.map(codeKey)));
      setReceived([]);
      setNow(Date.now());
      setLearning(true);
    } catch (e) {
      console.error((e as Error).message);
      setLearnError(true);
    }
  };

  useEffect(() => {
    if (!learning) return;
    let cancelled = false;
    const tick = () => {
      api.irReceived(deviceId)
        .then(list => { if (!cancelled) { setReceived(list); setNow(Date.now()); setLearnError(false); } })
        .catch(e => { console.error((e as Error).message); if (!cancelled) setLearnError(true); });
    };
    const timer = setInterval(tick, 1500);
    return () => { cancelled = true; clearInterval(timer); };
  }, [learning, api, deviceId]);

  const pick = (c: IrReceivedCode) => {
    setCode(normCode(c.code));
    setLearning(false);
  };

  const fresh = received.filter(c => !baseline.has(codeKey(c)));

  const codeValid = IR_CODE_REGEX.test(code.trim());
  const matched = codeValid ? catalog.signals.find(s => s.code === normCode(code)) : undefined;

  const updateDraft = (key: number, patch: Partial<Draft>) =>
    setDrafts(prev => prev.map(d => (d.key === key ? { ...d, ...patch } : d)));
  const move = (i: number, dir: -1 | 1) =>
    setDrafts(prev => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const isMissing = (d: Draft) =>
    (d.type === "power" && d.targetDeviceId !== null && !catalog.powerTargets.some(x => x.id === d.targetDeviceId)) ||
    (d.type === "ir" && d.signalId !== null && !catalog.signals.some(x => x.id === d.signalId));

  const actions = drafts.map(d => (isMissing(d) ? null : fromDraft(d)));
  const valid = name.trim() !== "" && codeValid && drafts.length >= 1 && drafts.length <= MAX_ACTIONS && actions.every(a => a !== null);

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    setError(null);
    const input: IrRuleInput = { name: name.trim(), code: code.trim(), enabled, actions: actions as IrAction[] };
    try {
      if (rule) await api.updateIrRule(deviceId, rule.id, input);
      else await api.createIrRule(deviceId, input);
      onSaved();
    } catch (e) {
      setError(describeError(e, t("irRules.saveFailed")));
      setSaving(false);
    }
  };

  const signalGroups = useMemo(() => {
    const map = new Map<string, SignalInfo[]>();
    for (const s of catalog.signals) {
      const label = (catalog.multipleIrDevices ? `${s.owner.name} · ` : "") + s.group;
      map.set(label, [...(map.get(label) ?? []), s]);
    }
    return [...map.entries()];
  }, [catalog]);

  return (
    <Modal show onHide={onClose} fullscreen="sm-down" scrollable>
      <Modal.Header closeButton>
        <Modal.Title>{rule ? t("irRules.edit") : t("irRules.add")}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <div className="alert alert-danger" style={{ whiteSpace: "pre-wrap" }}>{error}</div>}

        <Form.Group className="mb-3">
          <Form.Label>{t("irRules.name")}</Form.Label>
          <Form.Control size="lg" value={name} onChange={e => setName(e.target.value)} />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>{t("irRules.code")}</Form.Label>
          <div className="d-flex gap-2">
            <Form.Control
              size="lg"
              className="font-monospace"
              value={code}
              isInvalid={code !== "" && !codeValid}
              onChange={e => setCode(e.target.value)}
              placeholder="0x00F740BF"
              autoCapitalize="off"
              autoCorrect="off"
            />
            {learning ? (
              <Button variant="outline-secondary" size="lg" onClick={() => setLearning(false)}>{t("irRules.stopLearn")}</Button>
            ) : (
              <Button variant="outline-primary" size="lg" onClick={startLearn}>
                <i className="fa-solid fa-satellite-dish me-1"></i>{t("irRules.learn")}
              </Button>
            )}
          </div>
          {code !== "" && !codeValid && <div className="text-danger small mt-1">{t("irRules.codeInvalid")}</div>}
          {matched && <div className="text-muted small mt-1"><i className="fa-solid fa-link me-1"></i>{signalLabel(matched, catalog.multipleIrDevices)}</div>}
          {learnError && <div className="text-danger small mt-1">{t("irRules.learnFailed")}</div>}
          {learning && (
            <div className="mt-2">
              <div className="text-muted small mb-2">
                <span className="spinner-border spinner-border-sm me-2" role="status"></span>{t("irRules.learning")}
              </div>
              <div className="d-flex flex-wrap gap-2">
                {fresh.map(c => (
                  <Button key={codeKey(c)} variant="outline-success" onClick={() => pick(c)}>
                    <span className="font-monospace">{c.code}</span>
                    <span className="small ms-2">{c.protocol} · {t("irRules.ago", { s: Math.max(0, Math.round(now / 1000 - c.time)) })}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}
        </Form.Group>

        <div className="d-flex justify-content-between align-items-center mb-2">
          <Form.Label className="m-0">{t("irRules.actions")}</Form.Label>
        </div>
        {drafts.length === 0 && <div className="text-muted mb-2">{t("irRules.noActions")}</div>}

        {drafts.map((d, i) => {
          const missing = isMissing(d);
          return (
            <div key={d.key} className={"border rounded p-2 mb-2 " + (missing ? "border-warning border-2" : "")}>
              <div className="d-flex gap-2 align-items-center mb-2">
                <span className="text-muted">{i + 1}.</span>
                <Form.Select
                  value={d.type}
                  onChange={e => updateDraft(d.key, { type: e.target.value as Draft["type"] })}
                >
                  <option value="power">{t("irRules.type_power")}</option>
                  <option value="ir">{t("irRules.type_ir")}</option>
                  <option value="delay">{t("irRules.type_delay")}</option>
                </Form.Select>
                <Button variant="outline-secondary" disabled={i === 0} onClick={() => move(i, -1)} aria-label={t("irRules.moveUp")}>
                  <i className="fa-solid fa-arrow-up"></i>
                </Button>
                <Button variant="outline-secondary" disabled={i === drafts.length - 1} onClick={() => move(i, 1)} aria-label={t("irRules.moveDown")}>
                  <i className="fa-solid fa-arrow-down"></i>
                </Button>
                <Button variant="outline-danger" onClick={() => setDrafts(prev => prev.filter(x => x.key !== d.key))} aria-label={t("irRules.remove")}>
                  <i className="fa-solid fa-trash"></i>
                </Button>
              </div>

              {d.type === "power" && (
                <>
                  <Form.Select
                    className="mb-2"
                    value={d.targetDeviceId ?? ""}
                    onChange={e => updateDraft(d.key, { targetDeviceId: e.target.value === "" ? null : Number(e.target.value) })}
                  >
                    <option value="">{t("irRules.pickDevice")}</option>
                    {missing && <option value={d.targetDeviceId ?? ""}>⚠ {t("irRules.missing")} #{d.targetDeviceId}</option>}
                    {catalog.powerTargets.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </Form.Select>
                  <ButtonGroup className="w-100">
                    {(["on", "off", "toggle"] as IrPowerValue[]).map(v => (
                      <Button key={v} size="lg" variant={d.value === v ? "primary" : "outline-primary"} onClick={() => updateDraft(d.key, { value: v })}>
                        {t("irRules." + v)}
                      </Button>
                    ))}
                  </ButtonGroup>
                </>
              )}

              {d.type === "ir" && (
                <Form.Select
                  value={d.signalId ?? ""}
                  onChange={e => updateDraft(d.key, { signalId: e.target.value === "" ? null : Number(e.target.value) })}
                >
                  <option value="">{t("irRules.pickSignal")}</option>
                  {missing && <option value={d.signalId ?? ""}>⚠ {t("irRules.missing")} #{d.signalId}</option>}
                  {signalGroups.map(([label, list]) => (
                    <optgroup key={label} label={label}>
                      {list.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </optgroup>
                  ))}
                </Form.Select>
              )}

              {d.type === "delay" && (
                <Form.Group>
                  <Form.Control
                    type="number"
                    inputMode="decimal"
                    min={0.1}
                    max={60}
                    step={0.1}
                    value={d.delaySec}
                    isInvalid={delayMs(d) === null}
                    onChange={e => updateDraft(d.key, { delaySec: e.target.value })}
                    aria-label={t("irRules.seconds")}
                  />
                  <Form.Text>{t("irRules.seconds")} (0.1 – 60)</Form.Text>
                </Form.Group>
              )}

              {missing && <div className="text-warning small mt-1"><i className="fa-solid fa-triangle-exclamation me-1"></i>{t("irRules.missingHint")}</div>}
            </div>
          );
        })}

        <Button
          variant="outline-primary"
          className="w-100 mb-3"
          disabled={drafts.length >= MAX_ACTIONS}
          onClick={() => setDrafts(prev => [...prev, toDraft(null)])}
        >
          <i className="fa-solid fa-plus me-1"></i>{drafts.length >= MAX_ACTIONS ? t("irRules.maxActions") : t("irRules.addAction")}
        </Button>

        <Form.Check
          type="switch"
          id="rule-editor-enabled"
          label={t("irRules.enabled")}
          checked={enabled}
          onChange={e => setEnabled(e.target.checked)}
        />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>{t("irRules.cancel")}</Button>
        <Button variant="primary" onClick={save} disabled={!valid || saving}>
          {saving ? t("irRules.saving") : t("irRules.save")}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
