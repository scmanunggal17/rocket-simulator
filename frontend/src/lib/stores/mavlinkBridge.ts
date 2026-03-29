/**
 * mavlinkBridge.ts
 *
 * Listens for Wails events emitted by the Go MAVLink UDP receiver and writes
 * the parsed values directly into the Svelte stores that the UI reads from.
 *
 * Call startMavlinkBridge() when the user clicks Connect.
 * The returned function tears down all listeners on Disconnect.
 */

import { EventsOn } from "../../../wailsjs/runtime/runtime";
import {
    roll, pitch, yaw, rollRate, pitchRate, yawRate,
    accX, accY, accZ, gyroX, gyroY, gyroZ,
    magX, magY, magZ
} from "./imuStore";
import { currentAltitude, flightSpeed, verticalSpeed, rocketLat, rocketLon } from "./flightStore";
import { rssi, noise, connected, dataRate } from "./telemetryStore";

export function startMavlinkBridge(): () => void {
    const offs: Array<() => void> = [];

    // Connection state — only watch for unexpected drops (true is set by handleConnect)
    offs.push(EventsOn("mavlink:connected", (val: boolean) => {
        if (!val) connected.set(false);
    }));

    // Message rate
    offs.push(EventsOn("mavlink:rate", (count: number) => {
        dataRate.set(count);
    }));

    // ATTITUDE (#30) — roll/pitch/yaw and rates in degrees
    offs.push(EventsOn("mavlink:attitude", (d: any) => {
        roll.set(d.roll);
        pitch.set(d.pitch);
        yaw.set((d.yaw + 360) % 360);  // normalise to 0–360°
        rollRate.set(d.rollRate);
        pitchRate.set(d.pitchRate);
        yawRate.set(d.yawRate);
    }));

    // SCALED_IMU (#26) — all in SI / display units
    offs.push(EventsOn("mavlink:imu", (d: any) => {
        accX.set(d.accX);
        accY.set(d.accY);
        accZ.set(d.accZ);
        gyroX.set(d.gyroX);
        gyroY.set(d.gyroY);
        gyroZ.set(d.gyroZ);
        magX.set(d.magX);
        magY.set(d.magY);
        magZ.set(d.magZ);
    }));

    // GLOBAL_POSITION_INT (#33) — lat/lon/altitude
    offs.push(EventsOn("mavlink:position", (d: any) => {
        // lat/lon are 0 when no GPS fix; treat as no-fix
        if (d.lat !== 0 || d.lon !== 0) {
            rocketLat.set(d.lat);
            rocketLon.set(d.lon);
        }
        currentAltitude.set(d.altitude);
        verticalSpeed.set(d.vz);
    }));

    // VFR_HUD (#74) — speed m/s, altitude m, vertical speed m/s
    offs.push(EventsOn("mavlink:vfr", (d: any) => {
        flightSpeed.set(d.speed);
        currentAltitude.set(d.altitude);
        verticalSpeed.set(d.verticalSpeed);
    }));

    // RADIO_STATUS (#109) — raw 0–100 values
    offs.push(EventsOn("mavlink:radio", (d: any) => {
        rssi.set(d.rssi);
        noise.set(d.noise);
    }));

    return () => offs.forEach((off) => off());
}
