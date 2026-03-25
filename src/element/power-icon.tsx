"use client";

import DeviceEvent from "../api/types/device";

const zeroPad = (num: number): string => String(num).padStart(2, '0')

export default function PowerIcon({device}: {device: DeviceEvent}) {
    if (device.state.on === null) {
        let lastSeen;
        if (device.state.last !== null) {
            const parsed = new Date(device.state.last * 1000)
            lastSeen = (
                parsed.getFullYear() + "-" + zeroPad(parsed.getMonth()+1) + "-" + zeroPad(parsed.getDate()) + 
                " " + zeroPad(parsed.getHours()) + ":" + zeroPad(parsed.getMinutes())
            )
        } else {
            lastSeen = "?"
        }
        return <i className="fa fa-warning text-warning" title={"Last seen: " + lastSeen }></i>
    }

    return <i className={"fa fa-plug " + (device.state.on ? "text-success" : "text-danger")}></i> 
}