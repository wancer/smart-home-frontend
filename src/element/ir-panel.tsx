"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import HttpApi from "../api/http";
import DeviceEvent from "../api/types/device";
import IrRemote from "./ir-remote";
import IrRules from "./ir-rules";

type Props = { api: HttpApi; device: DeviceEvent; devices: DeviceEvent[] };

// Mount with key={device.id}: the selected tab is not reset on device change.
export default function IrPanel({ api, device, devices }: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"signals" | "rules">("signals");

  return (
    <>
      <ul className="nav nav-tabs mt-3">
        {(["signals", "rules"] as const).map(k => (
          <li className="nav-item" key={k}>
            <button className={"nav-link" + (tab === k ? " active" : "")} onClick={() => setTab(k)}>
              {t(k === "signals" ? "irRules.tabSignals" : "irRules.tabRules")}
            </button>
          </li>
        ))}
      </ul>
      {tab === "signals" && <IrRemote api={api} device={device} />}
      {tab === "rules" && <IrRules api={api} device={device} devices={devices} />}
    </>
  );
}
