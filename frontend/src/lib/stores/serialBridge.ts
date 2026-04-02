/**
 * serialBridge.ts
 *
 * Listens for Wails events emitted by the Go serial CSV reader and writes
 * the parsed values directly into the Svelte stores that the UI reads from.
 *
 * Call startSerialBridge() when the user clicks Connect.
 * The returned function tears down all listeners on Disconnect.
 */

import { EventsOn } from "../../../wailsjs/runtime/runtime";
import { roll, pitch, yaw } from "./imuStore";
import { currentAltitude, absoluteAltitude, rocketLat, rocketLon } from "./flightStore";
import { connected, dataRate } from "./telemetryStore";

export function startSerialBridge(): () => void {
    const offs: Array<() => void> = [];

    // Connection state — only watch for unexpected drops (true is set by handleConnect)
    offs.push(EventsOn("serial:connected", (val: boolean) => {
        if (!val) connected.set(false);
    }));

    // Message rate
    offs.push(EventsOn("serial:rate", (count: number) => {
        dataRate.set(count);
    }));

    // CSV data: altAbs, altRel, pitch, roll, yaw, lat, lon
    offs.push(EventsOn("serial:data", (d: any) => {
        absoluteAltitude.set(d.altitudeAbs);
        currentAltitude.set(d.altitudeRel);
        pitch.set(-d.pitch);
        roll.set(d.roll);
        yaw.set((d.yaw + 360) % 360);
        if (d.lat !== 0 || d.lon !== 0) {
            rocketLat.set(d.lat);
            rocketLon.set(d.lon);
        }
    }));

    return () => offs.forEach((off) => off());
}
