import { useState } from "react";
import { Button, Table, Modal, Form, Badge } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import DeviceEvent, { StorageTier } from "../api/types/device";
import HttpApi, { HttpError } from "../api/http";
import StorageTiersEditor, { DEFAULT_STORAGE_TIERS, formatTiers, validateTiers } from "../element/storage-tiers-editor";

type DevicesAdminPageProperties = {
  api: HttpApi;
  devices: DeviceEvent[];
  onDevicesChange: (devices: DeviceEvent[]) => void;
};

type DeviceFormData = {
  name: string;
  topic: string;
  enabled: boolean;
  offlineTimeout: number;
  storageTiers: StorageTier[];
};

const emptyForm: DeviceFormData = {
  name: "",
  topic: "",
  enabled: true,
  offlineTimeout: 0,
  storageTiers: DEFAULT_STORAGE_TIERS,
};

export default function DevicesAdminPage({ api, devices, onDevicesChange }: DevicesAdminPageProperties) {
  const { t } = useTranslation();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<DeviceFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wipeTarget, setWipeTarget] = useState<DeviceEvent | null>(null);
  const [wiping, setWiping] = useState(false);
  const [refreshingId, setRefreshingId] = useState<number | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setShowModal(true);
  };

  const openEdit = (device: DeviceEvent) => {
    setEditingId(device.id);
    setForm({
      name: device.name,
      topic: device.topic,
      enabled: device.enabled,
      offlineTimeout: device.offlineTimeout,
      storageTiers: device.storageTiers,
    });
    setError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.topic.trim()) {
      setError(t('devicesAdmin.nameTopicRequired'));
      return;
    }
    const tiersError = validateTiers(form.storageTiers);
    if (tiersError) {
      setError(t(tiersError));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editingId === null) {
        const created = await api.createDevice(form);
        const updated = { ...devices } as DeviceEvent[];
        updated[created.id] = created;
        onDevicesChange(updated);
      } else {
        const updated_device = await api.updateDevice(editingId, form);
        const updated = { ...devices } as DeviceEvent[];
        updated[editingId].name = updated_device.name;
        updated[editingId].topic = updated_device.topic;
        updated[editingId].enabled = updated_device.enabled;
        updated[editingId].offlineTimeout = updated_device.offlineTimeout;
        updated[editingId].storageTiers = updated_device.storageTiers;
        onDevicesChange(updated);
      }
      setShowModal(false);
    } catch (e) {
      setError(e instanceof HttpError && e.detail ? e.detail : (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleWipe = async () => {
    if (!wipeTarget) return;
    setWiping(true);
    try {
      await api.wipeSensorData(wipeTarget.id);
      // Wipe clears aggregates and daily only; archived is untouched.
      const target = wipeTarget;
      if (target.sensorHistory) {
        const updated = { ...devices } as unknown as Record<number, DeviceEvent>;
        const copy = Object.assign(Object.create(Object.getPrototypeOf(target)), target) as DeviceEvent;
        copy.sensorHistory = { ...target.sensorHistory, aggregates: 0, daily: 0, oldest: null };
        updated[target.id] = copy;
        onDevicesChange(updated as unknown as DeviceEvent[]);
      }
      setWipeTarget(null);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setWiping(false);
    }
  };

  const handleRefresh = async (device: DeviceEvent) => {
    setRefreshingId(device.id);
    try {
      const refreshed = await api.refreshProfile(device.id);
      if (refreshed === null) {
        alert(t('devicesAdmin.refreshOffline', { name: device.name }));
        return;
      }
      // keep the list-only data (sensor history) and the live state
      refreshed.sensorHistory = device.sensorHistory;
      refreshed.state = device.state;
      const updated = { ...devices } as unknown as Record<number, DeviceEvent>;
      updated[device.id] = refreshed;
      onDevicesChange(updated as unknown as DeviceEvent[]);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setRefreshingId(null);
    }
  };

  const handleDelete = async (device: DeviceEvent) => {
    if (!confirm(t('devicesAdmin.deleteConfirm', { name: device.name }))) return;
    try {
      await api.deleteDevice(device.id);
      const updated = { ...devices } as DeviceEvent[];
      delete updated[device.id];
      onDevicesChange(updated);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const deviceList = Object.values(devices);

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2><i className="fa-solid fa-gear me-2"></i>{t('devicesAdmin.title')}</h2>
        <Button variant="primary" onClick={openCreate}>
          <i className="fa-solid fa-plus me-1"></i> {t('devicesAdmin.addDevice')}
        </Button>
      </div>

      <Table striped bordered hover responsive>
        <thead>
          <tr>
            <th>{t('devicesAdmin.col_id')}</th>
            <th>{t('devicesAdmin.col_name')}</th>
            <th>{t('devicesAdmin.col_topic')}</th>
            <th>{t('devicesAdmin.col_sensorType')}</th>
            <th>{t('devicesAdmin.col_hardware')}</th>
            <th>{t('devicesAdmin.col_offlineTimeout')}</th>
            <th>{t('devicesAdmin.col_storage')}</th>
            <th>{t('devicesAdmin.col_enabled')}</th>
            <th>{t('devicesAdmin.col_history')}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {deviceList.map((device) => (
            <tr key={device.id}>
              <td>{device.id}</td>
              <td>{device.name}</td>
              <td><code>{device.topic}</code></td>
              <td>
                {t('devicesAdmin.type_' + device.sensorType, { defaultValue: device.sensorType })}
                {device.profile.sensors.length > 0 && (
                  <div className="small text-muted">{device.profile.sensors.join(", ")}</div>
                )}
              </td>
              <td className="small">
                {device.profile.template?.name && <div>{device.profile.template.name}</div>}
                {device.profile.chip && <div className="text-muted"><i className="fa fa-microchip me-1"></i>{device.profile.chip}</div>}
                {device.profile.firmwareVersion && <div className="text-muted">{device.profile.firmwareVersion}</div>}
                {device.profile.profiledAt == null && <span className="text-muted">{t('devicesAdmin.profileUnknown')}</span>}
              </td>
              <td>{device.offlineTimeout > 0 ? `${device.offlineTimeout} s` : <span className="text-muted">{t('devicesAdmin.auto')}</span>}</td>
              <td className="small text-nowrap">{formatTiers(t, device.storageTiers)}</td>
              <td>{device.enabled ? <Badge bg="success">{t('devicesAdmin.yes')}</Badge> : <Badge bg="danger">{t('devicesAdmin.no')}</Badge>}</td>
              <td className="small">
                {device.sensorHistory ? (
                  <>
                    <div>{t('devicesAdmin.history_aggregates')}: {device.sensorHistory.aggregates.toLocaleString()}</div>
                    <div>{t('devicesAdmin.history_daily')}: {device.sensorHistory.daily.toLocaleString()}</div>
                    <div>{t('devicesAdmin.history_archived')}: {device.sensorHistory.archived.toLocaleString()}</div>
                    <div className="text-muted">
                      {t('devicesAdmin.history_oldest')}: {device.sensorHistory.oldest != null
                        ? new Date(device.sensorHistory.oldest * 1000).toLocaleDateString()
                        : '—'}
                    </div>
                  </>
                ) : (
                  <span className="text-muted">{t('devicesAdmin.history_unknown')}</span>
                )}
              </td>
              <td>
                <Button variant="outline-secondary" size="sm" className="me-2" onClick={() => handleRefresh(device)}
                  disabled={refreshingId === device.id} title={t('devicesAdmin.refreshProfile')}>
                  <i className={"fa-solid fa-rotate" + (refreshingId === device.id ? " fa-spin" : "")}></i>
                </Button>
                <Button variant="outline-secondary" size="sm" className="me-2" onClick={() => openEdit(device)}>
                  <i className="fa-solid fa-pen"></i>
                </Button>
                <Button variant="outline-warning" size="sm" className="me-2" onClick={() => setWipeTarget(device)} title={t('devicesAdmin.wipeSensorData')}>
                  <i className="fa-solid fa-broom"></i>
                </Button>
                <Button variant="outline-danger" size="sm" onClick={() => handleDelete(device)}>
                  <i className="fa-solid fa-trash"></i>
                </Button>
              </td>
            </tr>
          ))}
          {deviceList.length === 0 && (
            <tr>
              <td colSpan={10} className="text-center text-muted">{t('devicesAdmin.noDevices')}</td>
            </tr>
          )}
        </tbody>
      </Table>

      <Modal show={wipeTarget !== null} onHide={() => setWipeTarget(null)}>
        <Modal.Header closeButton>
          <Modal.Title>{t('devicesAdmin.wipeSensorData')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {t('devicesAdmin.wipeConfirm', { name: wipeTarget?.name })}
          <div className="text-muted small mt-2">{t('devicesAdmin.wipeNote')}</div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setWipeTarget(null)}>{t('devicesAdmin.cancel')}</Button>
          <Button variant="danger" onClick={handleWipe} disabled={wiping}>
            {wiping ? t('devicesAdmin.wiping') : t('devicesAdmin.wipeConfirmBtn')}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{editingId === null ? t('devicesAdmin.addDevice') : t('devicesAdmin.editDevice')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <div className="alert alert-danger">{error}</div>}
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>{t('devicesAdmin.form_name')}</Form.Label>
              <Form.Control
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Living Room Plug"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>{t('devicesAdmin.form_topic')}</Form.Label>
              <Form.Control
                value={form.topic}
                onChange={(e) => setForm({ ...form, topic: e.target.value })}
                placeholder="plug-living-room"
              />
              <Form.Text className="text-muted">
                {t('devicesAdmin.form_topicHelp')}
              </Form.Text>
            </Form.Group>
            <div className="text-muted small mb-3">{t('devicesAdmin.form_detectedHelp')}</div>
            <Form.Group className="mb-3" controlId="deviceOfflineTimeout">
              <Form.Label>{t('devicesAdmin.form_offlineTimeout')}</Form.Label>
              <Form.Control
                type="number"
                min={0}
                step={1}
                value={form.offlineTimeout}
                onChange={(e) => setForm({ ...form, offlineTimeout: Math.max(0, Math.floor(+e.target.value || 0)) })}
              />
              <Form.Text className="text-muted">
                {t('devicesAdmin.form_offlineTimeoutHelp')}
              </Form.Text>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>{t('devicesAdmin.form_storage')}</Form.Label>
              <StorageTiersEditor
                tiers={form.storageTiers}
                onChange={(storageTiers) => setForm({ ...form, storageTiers })}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Check
                type="switch"
                label={t('devicesAdmin.form_enabled')}
                checked={form.enabled}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>{t('devicesAdmin.cancel')}</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? t('devicesAdmin.saving') : t('devicesAdmin.save')}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
