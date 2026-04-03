import { writable } from "svelte/store";
import { pitch, roll, yaw, pitchRate, rollRate, yawRate, accX, accY, accZ, gyroX, gyroY, gyroZ, magX, magY, magZ } from "./imuStore";

export const absoluteAltitude = writable(0);  // m (above sea level)
export const maxAltitude = writable(0);       // m
export const currentAltitude = writable(0);   // m (relative)
export const fuelUsed = writable(0);          // kg
export const fuelCapacity = writable(450);    // kg
export const flightSpeed = writable(0);       // m/s
export const flightDuration = writable(0);    // s
export const verticalSpeed = writable(0);     // m/s
export const acceleration = writable(0);      // m/s²
export const downrangeDistance = writable(0); // km
export const apogeeEta = writable(0);         // s
export const rocketLat = writable<number | null>(null);  // degrees, null = no fix
export const rocketLon = writable<number | null>(null);  // degrees, null = no fix

/** Initial values the user enters in SIM mode — matches the serial CSV fields + rocket specs */
export interface SimInitialValues {
    altitudeAbs: number;  // m ASL
    altitudeRel: number;  // m AGL (launch site)
    pitch: number;        // deg
    roll: number;         // deg
    yaw: number;          // deg
    lat: number;          // degrees
    lon: number;          // degrees
    dryMass: number;      // kg
    thrust: number;       // N
    burnTime: number;     // s
    fuelMass: number;     // kg
}

const G = 9.80665;

/**
 * Starts a simple flight simulation using user-provided initial values.
 * The simulation evolves altitude, attitude, and position over time
 * following a basic boost → coast → apogee → descent → landed profile.
 */
export function startFlightSimulation(
    init: SimInitialValues,
    onPhaseChange?: (phase: string) => void
): () => void {
    const burnTime = init.burnTime;
    const boostAccel = init.thrust / init.dryMass;
    const fuelRate = init.fuelMass / burnTime; // kg/s

    // Set fuel capacity from user input
    fuelCapacity.set(init.fuelMass);

    // Physics state — pitch determines vertical/horizontal split
    const pitchRad = (init.pitch * Math.PI) / 180; // 90° = straight up, 0° = horizontal
    let vx = 0; // horizontal speed (m/s)
    let vz = 0; // vertical speed (m/s)
    let alt = init.altitudeRel;  // relative altitude (m)
    let downrange = 0; // horizontal distance (m)

    let t = 0;
    let _maxAlt = 0;
    let _landed = false;
    const dt = 0.1;

    const baseLat = init.lat;
    const baseLon = init.lon;
    const yawRad = (init.yaw * Math.PI) / 180;

    let intervalId: ReturnType<typeof setInterval>;

    intervalId = setInterval(() => {
        if (_landed) { clearInterval(intervalId); return; }
        t += dt;

        // Current pitch: starts at init.pitch, gravity turn tips it over gradually
        const currentPitch = Math.max(0, init.pitch - (t > burnTime ? 15 : 5) * (t / burnTime));
        const cpRad = (currentPitch * Math.PI) / 180;

        // Forces
        if (t <= burnTime) {
            // Boost: thrust along rocket axis decomposed by pitch
            const accel = boostAccel - G * Math.sin(cpRad);
            vz += (Math.sin(cpRad) * boostAccel - G) * dt;
            vx += Math.cos(cpRad) * boostAccel * dt;
        } else {
            // Coast/descent: only gravity
            vz -= G * dt;
            // Drag approximation
            vx *= (1 - 0.002);
        }

        // Don't go below ground
        alt += vz * dt;
        if (alt < init.altitudeRel && t > burnTime + 1) {
            alt = init.altitudeRel;
            vz = 0;
            vx = 0;
            _landed = true;
        }
        downrange += Math.abs(vx) * dt;

        if (alt > _maxAlt) _maxAlt = alt;

        const totalSpeed = Math.sqrt(vx * vx + vz * vz);

        // Attitude: pitch follows velocity vector after burnout, with some oscillation
        const simPitch = t <= burnTime
            ? currentPitch + (Math.random() - 0.5) * 0.3
            : Math.atan2(vz, Math.abs(vx)) * (180 / Math.PI) + (Math.random() - 0.5) * 0.5;
        const simRoll = init.roll + Math.sin(t * 0.4) * 2.5;
        const simYaw = (init.yaw + t * 0.8) % 360;

        pitch.set(simPitch);
        roll.set(simRoll);
        yaw.set(simYaw);
        pitchRate.set((Math.random() - 0.5) * 0.4);
        rollRate.set(Math.cos(t * 0.4) * 2.5 * 0.4);
        yawRate.set(0.8);

        const pr = (simPitch * Math.PI) / 180;
        const rr = (simRoll * Math.PI) / 180;
        const yr = (simYaw * Math.PI) / 180;
        const gLoad = t < burnTime ? boostAccel : G;
        accX.set(-Math.sin(pr) * gLoad + (Math.random() - 0.5) * 0.15);
        accY.set(Math.sin(rr) * Math.cos(pr) * G + (Math.random() - 0.5) * 0.15);
        accZ.set(Math.cos(rr) * Math.cos(pr) * G + (Math.random() - 0.5) * 0.15);
        gyroX.set((Math.random() - 0.5) * 1.0);
        gyroY.set((Math.random() - 0.5) * 1.0);
        gyroZ.set(0.8 + (Math.random() - 0.5) * 0.5);
        magX.set(Math.cos(yr) * 250 + (Math.random() - 0.5) * 8);
        magY.set(Math.sin(yr) * 250 + (Math.random() - 0.5) * 8);
        magZ.set(-400 + (Math.random() - 0.5) * 8);

        // GPS: project downrange along yaw heading
        const lat = baseLat + (downrange * Math.cos(yawRad)) / 111000.0;
        const lon = baseLon + (downrange * Math.sin(yawRad)) / (111000.0 * Math.cos(baseLat * Math.PI / 180));
        rocketLat.set(lat);
        rocketLon.set(lon);

        const altAbs = init.altitudeAbs + (alt - init.altitudeRel);

        // Telemetry stores
        absoluteAltitude.set(altAbs);
        currentAltitude.set(alt);
        maxAltitude.set(_maxAlt);
        flightDuration.set(t);
        flightSpeed.set(totalSpeed);
        verticalSpeed.set(vz);
        acceleration.set(t < burnTime ? boostAccel : -G + (Math.random() - 0.5) * 2);
        downrangeDistance.set(downrange / 1000); // km
        apogeeEta.set(vz > 0 ? vz / G : 0);
        fuelUsed.set(Math.min(t * fuelRate, init.fuelMass));

        if (onPhaseChange) {
            if (_landed) {
                onPhaseChange("LANDED");
            } else if (t < burnTime) {
                onPhaseChange("BOOST");
            } else if (vz > 5) {
                onPhaseChange("COAST");
            } else if (vz >= -5 && vz <= 5) {
                onPhaseChange("APOGEE");
            } else {
                onPhaseChange("DESCENT");
            }
        }
    }, 100);

    return () => clearInterval(intervalId);
}
