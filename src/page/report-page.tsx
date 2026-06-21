"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, ButtonGroup, Spinner, Table } from "react-bootstrap";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarController,
  BarElement,
  Legend,
  Tooltip,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarController, BarElement, Legend, Tooltip);

import HttpApi from "../api/http.ts";
import DeviceEvent from "../api/types/device.ts";
import SensorDailyEvent from "../api/types/sensor-daily.ts";

const PALETTE = [
  { border: "#ef4444", background: "rgba(239,68,68,0.75)" },
  { border: "#3b82f6", background: "rgba(59,130,246,0.75)" },
  { border: "#10b981", background: "rgba(16,185,129,0.75)" },
  { border: "#f97316", background: "rgba(249,115,22,0.75)" },
  { border: "#8b5cf6", background: "rgba(139,92,246,0.75)" },
  { border: "#06b6d4", background: "rgba(6,182,212,0.75)" },
  { border: "#f59e0b", background: "rgba(245,158,11,0.75)" },
  { border: "#ec4899", background: "rgba(236,72,153,0.75)" },
];

type MonthYear = { year: number; month: number };

function monthStart(m: MonthYear): string {
  return `${m.year}-${String(m.month).padStart(2, "0")}-01`;
}

function monthEnd(m: MonthYear): string {
  const lastDay = new Date(m.year, m.month, 0).getDate();
  return `${m.year}-${String(m.month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

function daysInMonth(m: MonthYear): string[] {
  const last = new Date(m.year, m.month, 0).getDate();
  return Array.from({ length: last }, (_, i) => String(i + 1));
}

function formatMonthLabel(m: MonthYear, locale: string): string {
  return new Date(m.year, m.month - 1, 1).toLocaleString(locale, { month: "long", year: "numeric" });
}

type ReportPageProperties = {
  api: HttpApi;
  devices: DeviceEvent[];
};

export default function ReportPage({ api, devices }: ReportPageProperties) {
  const { t, i18n } = useTranslation();
  const energyDevices = Object.values(devices).filter((d) => d.enabled && d.isEnergySensor());

  const [month, setMonth] = useState<MonthYear>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [data, setData] = useState<Record<number, SensorDailyEvent[]>>({});
  const [loading, setLoading] = useState(false);

  const prevMonth = () =>
    setMonth((m) => {
      const d = new Date(m.year, m.month - 2, 1);
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
    });

  const nextMonth = () =>
    setMonth((m) => {
      const d = new Date(m.year, m.month, 1);
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
    });

  const isCurrentMonth = (() => {
    const now = new Date();
    return month.year === now.getFullYear() && month.month === now.getMonth() + 1;
  })();

  useEffect(() => {
    if (energyDevices.length === 0) return;
    setLoading(true);
    const from = monthStart(month);
    const till = monthEnd(month);
    Promise.all(
      energyDevices.map((d) => api.sensorsDaily(d.id, from, till).then((rows) => ({ id: d.id, rows })))
    ).then((results) => {
      const map: Record<number, SensorDailyEvent[]> = {};
      for (const r of results) map[r.id] = r.rows;
      setData(map);
      setLoading(false);
    });
  }, [month, energyDevices.length]);

  const days = daysInMonth(month);

  const chartData = {
    labels: days,
    datasets: energyDevices.map((device, idx) => {
      const color = PALETTE[idx % PALETTE.length];
      const rows = data[device.id] ?? [];
      const byDay: Record<string, number | null> = {};
      for (const row of rows) {
        const day = String(parseInt(row.date.split("-")[2], 10));
        byDay[day] = row.power != null ? +row.power.toFixed(3) : null;
      }
      return {
        label: device.name,
        data: days.map((d) => byDay[d] ?? null),
        backgroundColor: color.background,
        borderColor: color.border,
        borderWidth: 1,
        borderRadius: 3,
      };
    }),
  };

  const chartOptions = {
    responsive: true,
    animation: { duration: 0 as const },
    interaction: { mode: "index" as const },
    plugins: {
      legend: { position: "top" as const },
      tooltip: {
        callbacks: {
          label: (ctx: any) =>
            ctx.parsed.y != null ? `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(3)} kWh` : "",
        },
      },
    },
    scales: {
      x: { stacked: true, ticks: { maxRotation: 0 } },
      y: {
        stacked: true,
        min: 0,
        title: { display: true, text: "kWh" },
      },
    },
  };

  const totals = energyDevices.map((device) => {
    const rows = data[device.id] ?? [];
    const sum = rows.reduce((acc, r) => acc + (r.power ?? 0), 0);
    return { device, sum: +sum.toFixed(3) };
  });

  return (
    <div>
      <div className="d-flex align-items-center gap-3 mb-3">
        <h4 className="mb-0">{t("report.title")}</h4>
        <ButtonGroup size="sm">
          <Button variant="outline-secondary" onClick={prevMonth}>
            <i className="fa fa-chevron-left" />
          </Button>
          <Button variant="outline-secondary" disabled style={{ minWidth: 160 }}>
            {formatMonthLabel(month, i18n.language)}
          </Button>
          <Button variant="outline-secondary" onClick={nextMonth} disabled={isCurrentMonth}>
            <i className="fa fa-chevron-right" />
          </Button>
        </ButtonGroup>
      </div>

      {loading && (
        <div className="text-center py-4">
          <Spinner animation="border" size="sm" />
        </div>
      )}

      {!loading && energyDevices.length === 0 && (
        <p className="text-muted">{t("report.noDevices")}</p>
      )}

      {!loading && energyDevices.length > 0 && (
        <>
          <Bar data={chartData} options={chartOptions} />

          <Table size="sm" className="mt-3" style={{ maxWidth: 400 }}>
            <thead>
              <tr>
                <th>{t("report.device")}</th>
                <th className="text-end">{t("report.total")}</th>
              </tr>
            </thead>
            <tbody>
              {totals.map(({ device, sum }, idx) => (
                <tr key={device.id}>
                  <td>
                    <span
                      className="d-inline-block me-2"
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 2,
                        backgroundColor: PALETTE[idx % PALETTE.length].border,
                      }}
                    />
                    {device.name}
                  </td>
                  <td className="text-end">{`${sum.toFixed(3)} kWh`}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}
    </div>
  );
}
