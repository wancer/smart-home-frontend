"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Collapse, Form, Modal } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import HttpApi, { HttpError } from "../api/http";
import DeviceEvent from "../api/types/device";
import { useToasts } from "./use-toasts";
import { IR_CODE_REGEX, IrGroup, IrSignal } from "../api/types/ir";

type Props = { api: HttpApi; device: DeviceEvent };

type FormState = { group: string; name: string; code: string; protocol: string; bits: string };

const emptyForm: FormState = { group: "", name: "", code: "", protocol: "NEC", bits: "32" };

// Mount with key={device.id}: state is not reset on device change.
export default function IrRemote({ api, device }: Props) {
  const { t } = useTranslation();
  const deviceId = device.id;

  const [groups, setGroups] = useState<IrGroup[] | undefined>(undefined);
  const [loadError, setLoadError] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [sending, setSending] = useState<Set<number>>(new Set());
  const [pressed, setPressed] = useState<number | null>(null);
  const { toast, toastNode } = useToasts();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<IrSignal | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);


  const load = useCallback(async () => {
    try {
      setGroups(await api.irSignals(deviceId));
      setLoadError(false);
    } catch (e) {
      console.error((e as Error).message);
      setLoadError(true);
    }
  }, [api, deviceId]);

  useEffect(() => {
    let cancelled = false;
    api.irSignals(deviceId)
      .then(g => { if (!cancelled) setGroups(g); })
      .catch(e => { console.error((e as Error).message); if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, [api, deviceId]);

  const send = async (s: IrSignal) => {
    if (editMode || sending.has(s.id)) return;
    setSending(prev => new Set(prev).add(s.id));
    setPressed(s.id);
    setTimeout(() => setPressed(p => (p === s.id ? null : p)), 300);
    try {
      await api.sendIrSignal(deviceId, s.id);
      toast(t("ir.sent", { name: s.name }), "success");
    } catch (e) {
      console.error((e as Error).message);
      toast(t("ir.sendFailed", { name: s.name }), "danger");
    } finally {
      setSending(prev => {
        const next = new Set(prev);
        next.delete(s.id);
        return next;
      });
    }
  };

  const openAdd = (group = "") => {
    setEditing(null);
    setForm({ ...emptyForm, group });
    setShowAdvanced(false);
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (s: IrSignal) => {
    setEditing(s);
    setForm({ group: s.group, name: s.name, code: s.code, protocol: s.protocol, bits: String(s.bits) });
    setShowAdvanced(s.protocol !== "NEC" || s.bits !== 32);
    setFormError(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    const group = form.group.trim();
    const name = form.name.trim();
    const code = form.code.trim();
    const protocol = form.protocol.trim() || "NEC";
    const bits = form.bits.trim() === "" ? 32 : Number(form.bits);
    if (!group || !name) return setFormError(t("ir.required"));
    if (!IR_CODE_REGEX.test(code)) return setFormError(t("ir.codeInvalid"));
    if (!Number.isInteger(bits) || bits <= 0) {
      setShowAdvanced(true);
      return setFormError(t("ir.bitsInvalid"));
    }
    setSaving(true);
    setFormError(null);
    try {
      const data = { group, name, code, protocol, bits };
      if (editing) await api.updateIrSignal(deviceId, editing.id, data);
      else await api.createIrSignal(deviceId, data);
      setShowForm(false);
      await load();
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 0;
      setFormError(status === 409 ? t("ir.exists") : status === 400 ? t("ir.validation") : t("ir.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (s: IrSignal) => {
    if (!confirm(t("ir.deleteConfirm", { name: s.name }))) return;
    try {
      await api.deleteIrSignal(deviceId, s.id);
      await load();
    } catch (e) {
      console.error((e as Error).message);
      toast(t("ir.deleteFailed"), "danger");
    }
  };

  return (
    <>
      <div className="d-flex justify-content-between align-items-center my-3 gap-2">
        <h4 className="m-0">{t("ir.title")}</h4>
        <div className="d-flex gap-2">
          <Button variant={editMode ? "primary" : "outline-secondary"} onClick={() => setEditMode(m => !m)}>
            <i className={"fa-solid me-1 " + (editMode ? "fa-check" : "fa-pen")}></i>
            {editMode ? t("ir.done") : t("ir.editMode")}
          </Button>
          <Button variant="primary" onClick={() => openAdd()}>
            <i className="fa-solid fa-plus me-1"></i>{t("ir.add")}
          </Button>
        </div>
      </div>

      {groups === undefined && !loadError && (
        <div className="text-center py-5">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">{t("app.loading")}</span>
          </div>
        </div>
      )}

      {loadError && (
        <div className="alert alert-danger d-flex justify-content-between align-items-center">
          <span>{t("ir.loadError")}</span>
          <Button variant="outline-danger" size="sm" onClick={load}>{t("ir.retry")}</Button>
        </div>
      )}

      {!loadError && groups !== undefined && groups.length === 0 && (
        <div className="text-center text-muted py-5">{t("ir.empty")}</div>
      )}

      {!loadError && groups?.map(g => (
        <div key={g.group} className="card mb-3">
          <div className="card-header fw-bold">{g.group}</div>
          <div className="card-body">
            <div className="row g-2">
              {g.signals.map(s => (
                <div key={s.id} className="col-6 col-md-4 col-lg-3">
                  {editMode ? (
                    <div className="d-flex gap-1">
                      <div className="flex-grow-1 border rounded px-2 py-2 text-truncate" title={`${s.code} (${s.protocol}, ${s.bits})`}>
                        {s.name}
                      </div>
                      <Button variant="outline-secondary" onClick={() => openEdit(s)} aria-label={t("ir.edit")}>
                        <i className="fa-solid fa-pen"></i>
                      </Button>
                      <Button variant="outline-danger" onClick={() => handleDelete(s)} aria-label={t("ir.delete")}>
                        <i className="fa-solid fa-trash"></i>
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant={pressed === s.id ? "primary" : "outline-primary"}
                      size="lg"
                      className="w-100 py-3"
                      style={{ minHeight: 64 }}
                      disabled={sending.has(s.id)}
                      onClick={() => send(s)}
                    >
                      {s.name}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}

      <Modal show={showForm} onHide={() => setShowForm(false)}>
        <Modal.Header closeButton>
          <Modal.Title>{editing ? t("ir.edit") : t("ir.add")}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {formError && <div className="alert alert-danger">{formError}</div>}
          <Form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
            <Form.Group className="mb-3">
              <Form.Label>{t("ir.group")}</Form.Label>
              <Form.Control
                list="ir-groups"
                value={form.group}
                onChange={(e) => setForm({ ...form, group: e.target.value })}
                placeholder="Stereo"
              />
              <datalist id="ir-groups">
                {groups?.map(g => <option key={g.group} value={g.group} />)}
              </datalist>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>{t("ir.name")}</Form.Label>
              <Form.Control
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Volume +"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>{t("ir.code")}</Form.Label>
              <Form.Control
                className="font-monospace"
                value={form.code}
                isInvalid={form.code !== "" && !IR_CODE_REGEX.test(form.code.trim())}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="0x00F740BF"
                autoCapitalize="off"
                autoCorrect="off"
              />
              <Form.Control.Feedback type="invalid">{t("ir.codeInvalid")}</Form.Control.Feedback>
            </Form.Group>

            <Button variant="link" className="p-0 mb-2" onClick={() => setShowAdvanced(v => !v)} aria-expanded={showAdvanced}>
              <i className={"fa-solid me-1 " + (showAdvanced ? "fa-chevron-down" : "fa-chevron-right")}></i>
              {t("ir.advanced")}
            </Button>
            <Collapse in={showAdvanced}>
              <div>
                <Form.Group className="mb-3">
                  <Form.Label>{t("ir.protocol")}</Form.Label>
                  <Form.Control value={form.protocol} onChange={(e) => setForm({ ...form, protocol: e.target.value })} />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>{t("ir.bits")}</Form.Label>
                  <Form.Control type="number" min={1} value={form.bits} onChange={(e) => setForm({ ...form, bits: e.target.value })} />
                </Form.Group>
              </div>
            </Collapse>
            <button type="submit" hidden />
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowForm(false)}>{t("ir.cancel")}</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? t("ir.saving") : t("ir.save")}
          </Button>
        </Modal.Footer>
      </Modal>

      {toastNode}
    </>
  );
}
