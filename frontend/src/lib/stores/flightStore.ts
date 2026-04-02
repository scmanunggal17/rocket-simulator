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

export interface FlightSimConfig {
    fuelCapacity: number; // kg
    thrust: number; // N
    burnTime: number; // s
    launchAngle: number; // deg (45–90)
}

const G = 9.80665;
const DRY_MASS = 8.5; // kg

export function startFlightSimulation(
    config: FlightSimConfig = { fuelCapacity: 450, thrust: 5000, burnTime: 8, launchAngle: 90 },
    onPhaseChange?: (phase: string) => void
): () => void {
    // ── Derived flight envelope ───────────────────────────────────────────────
    // Averaged mass during burn
    const avgMass = DRY_MASS + config.fuelCapacity / 2;
    // Net vertical acceleration during boost (thrust projected + gravity)
    const angleRad = (config.launchAngle * Math.PI) / 180;
    const netAcc = (config.thrust / avgMass) * Math.sin(angleRad) - G;
    // Peak vertical speed at end of burn
    const peakVz = Math.max(50, netAcc * config.burnTime);
    // Approximate coast+descent duration: up (v/g) + down same
    const coastTime = peakVz / G;
    const totalFlightTime = config.burnTime + coastTime * 2.2; // 2.2× for parachute descent

    let t = 0;
    let _maxAlt = 0;
    let _landed = false;
    const dt = 0.1;
    let intervalId: ReturnType<typeof setInterval>;

    intervalId = setInterval(() => {
        if (_landed) { clearInterval(intervalId); return; }
        t += dt;

        const phase = Math.min(t / totalFlightTime, 1);
        // Altitude follows a sine arch scaled by peak altitude
        const peakAlt = 0.5 * peakVz * coastTime;
        const alt = Math.max(0, Math.sin(phase * Math.PI) * peakAlt);
        if (alt > _maxAlt) _maxAlt = alt;

        const vSpeed = Math.cos(phase * Math.PI) * peakVz + (Math.random() - 0.5) * 5;
        const topSpeed = peakVz / Math.sin(angleRad); // total velocity at burnout

        // ── Attitude: pitch starts at launchAngle, tips 8° during coast ───────
        const tiltOver = phase < 0.5
            ? config.launchAngle - (config.launchAngle - (config.launchAngle - 8)) * (phase / 0.5)
            : (config.launchAngle - 8) + 8 * ((phase - 0.5) / 0.5); // nose drops on descent
        const simPitch = tiltOver + (Math.random() - 0.5) * 0.3;
        const simRoll = Math.sin(t * 0.4) * 2.5;
        const simYaw = (t * 0.8) % 360;
        pitch.set(simPitch);
        roll.set(simRoll);
        yaw.set(simYaw);
        pitchRate.set((Math.random() - 0.5) * 0.4);
        rollRate.set(Math.cos(t * 0.4) * 2.5 * 0.4);
        yawRate.set(0.8);
        const pr = (simPitch * Math.PI) / 180;
        const rr = (simRoll * Math.PI) / 180;
        const yr = (simYaw * Math.PI) / 180;
        const gLoad = t < config.burnTime ? config.thrust / avgMass : G;
        accX.set(-Math.sin(pr) * gLoad + (Math.random() - 0.5) * 0.15);
        accY.set(Math.sin(rr) * Math.cos(pr) * G + (Math.random() - 0.5) * 0.15);
        accZ.set(Math.cos(rr) * Math.cos(pr) * G + (Math.random() - 0.5) * 0.15);
        gyroX.set((Math.random() - 0.5) * 1.0);
        gyroY.set((Math.random() - 0.5) * 1.0);
        gyroZ.set(0.8 + (Math.random() - 0.5) * 0.5);
        magX.set(Math.cos(yr) * 250 + (Math.random() - 0.5) * 8);
        magY.set(Math.sin(yr) * 250 + (Math.random() - 0.5) * 8);
        magZ.set(-400 + (Math.random() - 0.5) * 8);

        // ── Telemetry stores ──────────────────────────────────────────────────
        currentAltitude.set(alt);
        maxAltitude.set(_maxAlt);
        flightDuration.set(t);
        flightSpeed.set(Math.abs(Math.cos(phase * Math.PI) * topSpeed + Math.random() * 10));
        verticalSpeed.set(vSpeed);
        acceleration.set(-Math.sin(phase * Math.PI) * (config.thrust / avgMass) + (Math.random() - 0.5) * 2);
        fuelUsed.set(Math.min(t / config.burnTime * config.fuelCapacity, config.fuelCapacity));
        downrangeDistance.set(phase * peakAlt * Math.cos(angleRad) / 1000); // km
        apogeeEta.set(Math.max(0, (totalFlightTime / 2) - t + (Math.random() - 0.5) * 1));

        if (onPhaseChange) {
            if (t < config.burnTime) {
                onPhaseChange("BOOST");
            } else if (alt <= 50 && phase > 0.5) {
                _landed = true;
                onPhaseChange("LANDED");
            } else if (vSpeed > 20) {
                onPhaseChange("COAST");
            } else if (vSpeed >= -20 && vSpeed <= 20) {
                onPhaseChange("APOGEE");
            } else {
                onPhaseChange("DESCENT");
            }
        }
    }, 100);

    return () => clearInterval(intervalId);
}
