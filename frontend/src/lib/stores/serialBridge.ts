/**
 * serialBridge.ts
 *
 * Listens for Wails events emitted by the Go serial CSV reader and writes
 * the parsed values directly into the Svelte stores that the UI reads from.
 *
 * In CONTROLLER mode, the bridge also auto-derives values not provided by
 * the controller: vertical speed, max altitude, flight duration, downrange
 * distance, and acceleration.
 *
 * Call startSerialBridge() when the user clicks Connect.
 * The returned function tears down all listeners on Disconnect.
 */

import { EventsOn } from "../../../wailsjs/runtime/runtime";
import { roll, pitch, yaw } from "./imuStore";
import {
    currentAltitude, absoluteAltitude, rocketLat, rocketLon,
    maxAltitude, verticalSpeed, flightDuration, flightSpeed,
    acceleration, downrangeDistance,
} from "./flightStore";
import { connected, dataRate, lastSerialData } from "./telemetryStore";
import { simulating, flightPhase } from "./simulationControl";
import { imuSource } from "./imuSource";
import { get } from "svelte/store";

export function startSerialBridge(): () => void {
    const offs: Array<() => void> = [];

    // State for auto-derivation
    let prevAlt: number | null = null;
    let prevVz = 0;
    let prevTs: number | null = null;
    let startTs: number | null = null;
    let startLat: number | null = null;
    let startLon: number | null = null;
    let _maxAlt = 0;

    // Connection state — only watch for unexpected drops (true is set by handleConnect)
    offs.push(EventsOn("serial:connected", (val: boolean) => {
        if (!val) {
            connected.set(false);
            // Reset derivation state on disconnect
            prevAlt = null;
            prevVz = 0;
            prevTs = null;
            startTs = null;
            startLat = null;
            startLon = null;
            _maxAlt = 0;
        }
    }));

    // Message rate
    offs.push(EventsOn("serial:rate", (count: number) => {
        dataRate.set(count);
    }));

    // CSV data: altAbs, altRel, pitch, roll, yaw, lat, lon
    offs.push(EventsOn("serial:data", (d: any) => {
        // Always capture raw serial data for controller launch snapshot
        lastSerialData.set({
            altitudeAbs: d.altitudeAbs,
            altitudeRel: d.altitudeRel,
            pitch: d.pitch,
            roll: d.roll,
            yaw: d.yaw,
            lat: d.lat,
            lon: d.lon,
            nozzleType: d.nozzleType ?? 0,
        });

        // Ignore serial data when:
        // - simulation is running (simulation owns the stores)
        // - user hasn't confirmed yet (STANDBY)
        // - user chose SIMULATION mode (not controller)
        // - countdown is active (initial values already snapshotted)
        if (get(simulating)) return;
        const phase = get(flightPhase);
        if (phase === "STANDBY" || phase === "COUNTDOWN") return;
        if (get(imuSource) !== "real") return;

        const now = performance.now() / 1000; // seconds

        // Primary stores — set directly from controller
        absoluteAltitude.set(d.altitudeAbs);
        currentAltitude.set(d.altitudeRel);
        pitch.set(-d.pitch + 90);
        roll.set(d.roll);
        yaw.set((d.yaw + 360) % 360);
        if (d.lat !== 0 || d.lon !== 0) {
            rocketLat.set(d.lat);
            rocketLon.set(d.lon);
        }

        // --- Auto-derived values ---

        // Max altitude
        if (d.altitudeRel > _maxAlt) {
            _maxAlt = d.altitudeRel;
            maxAltitude.set(_maxAlt);
        }

        // Vertical speed & acceleration (from altitude deltas)
        if (prevTs !== null && prevAlt !== null) {
            const dt = now - prevTs;
            if (dt > 0) {
                const vz = (d.altitudeRel - prevAlt) / dt;
                verticalSpeed.set(vz);
                flightSpeed.set(Math.abs(vz));

                const az = (vz - prevVz) / dt;
                acceleration.set(az);
                prevVz = vz;
            }
        }
        prevAlt = d.altitudeRel;
        prevTs = now;

        // Flight duration (time since first data)
        if (startTs === null) startTs = now;
        flightDuration.set(now - startTs);

        // Downrange distance (great-circle from start position, in km)
        if (d.lat !== 0 || d.lon !== 0) {
            if (startLat === null) { startLat = d.lat; startLon = d.lon; }
            const dLat = (d.lat - startLat!) * 111.0;
            const dLon = (d.lon - startLon!) * 111.0 * Math.cos(startLat! * Math.PI / 180);
            downrangeDistance.set(Math.sqrt(dLat * dLat + dLon * dLon));
        }
    }));

    return () => offs.forEach((off) => off());
}
