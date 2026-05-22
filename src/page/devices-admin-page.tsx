"use client";

import { useState } from "react";
import { Button, Table, Modal, Form, Badge } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import DeviceEvent from "../api/types/device";
import HttpApi from "../api/http";

type DevicesAdminPageProperties = {
  api: HttpApi;
  devices: DeviceEvent[];
  onDevicesChange: (devices: DeviceEvent[]) => void;
};

type DeviceFormData = {
  name: string;
  topic: string;
  enabled: boolean;
  sensorType: string;
  supportsToggle: boolean;
};

const emptyForm: DeviceFormData = {
  name: "",
  topic: "",
  enabled: true,
  sensorType: "energy",
  supportsToggle: true,
};

export default function DevicesAdminPage({ api, devices, onDevicesChange }: DevicesAdminPageProperties) {
  const { t } = useTranslation();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<DeviceFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      sensorType: device.sensorType,
      supportsToggle: device.supportsToggle,
    });
    setError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.topic.trim()) {
      setError(t('devicesAdmin.nameTopicRequired'));
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
        updated[editingId].sensorType = updated_device.sensorType;
        updated[editingId].supportsToggle = updated_device.supportsToggle;
        onDevicesChange(updated);
      }
      setShowModal(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
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
            <th>{t('devicesAdmin.col_toggle')}</th>
            <th>{t('devicesAdmin.col_enabled')}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {deviceList.map((device) => (
            <tr key={device.id}>
              <td>{device.id}</td>
              <td>{device.name}</td>
              <td><code>{device.topic}</code></td>
              <td>{device.sensorType}</td>
              <td>{device.supportsToggle ? <Badge bg="success">{t('devicesAdmin.yes')}</Badge> : <Badge bg="secondary">{t('devicesAdmin.no')}</Badge>}</td>
              <td>{device.enabled ? <Badge bg="success">{t('devicesAdmin.yes')}</Badge> : <Badge bg="danger">{t('devicesAdmin.no')}</Badge>}</td>
              <td>
                <Button variant="outline-secondary" size="sm" className="me-2" onClick={() => openEdit(device)}>
                  <i className="fa-solid fa-pen"></i>
                </Button>
                <Button variant="outline-danger" size="sm" onClick={() => handleDelete(device)}>
                  <i className="fa-solid fa-trash"></i>
                </Button>
              </td>
            </tr>
          ))}
          {deviceList.length === 0 && (
            <tr>
              <td colSpan={7} className="text-center text-muted">{t('devicesAdmin.noDevices')}</td>
            </tr>
          )}
        </tbody>
      </Table>

      <Modal show={showModal} onHide={() => setShowModal(false)}>
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
            <Form.Group className="mb-3">
              <Form.Label>{t('devicesAdmin.form_sensorType')}</Form.Label>
              <Form.Select
                value={form.sensorType}
                onChange={(e) => setForm({ ...form, sensorType: e.target.value })}
              >
                <option value="energy">{t('devicesAdmin.form_sensorEnergy')}</option>
                <option value="co2">{t('devicesAdmin.form_sensorCo2')}</option>
                <option value="t-h">{t('devicesAdmin.form_sensorTH')}</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Check
                type="switch"
                label={t('devicesAdmin.form_supportsToggle')}
                checked={form.supportsToggle}
                onChange={(e) => setForm({ ...form, supportsToggle: e.target.checked })}
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
