import { writable } from "svelte/store";

export const maxAltitude = writable(0);       // m
export const currentAltitude = writable(0);   // m
export const fuelUsed = writable(0);          // kg
export const fuelCapacity = writable(450);    // kg
export const flightSpeed = writable(0);       // m/s
export const flightDuration = writable(0);    // s
export const verticalSpeed = writable(0);     // m/s
export const acceleration = writable(0);      // m/s²
export const downrangeDistance = writable(0); // km
export const apogeeEta = writable(0);         // s

export interface FlightSimConfig {
    fuelCapacity: number; // kg
    thrust: number;       // N
    burnTime: number;     // s
}

export function startFlightSimulation(
    config: FlightSimConfig = { fuelCapacity: 450, thrust: 5000, burnTime: 8 },
    onPhaseChange?: (phase: string) => void
): () => void {
    let t = 0;
    let _maxAlt = 0;
    let _landed = false;
    const dt = 0.1;
    let intervalId: ReturnType<typeof setInterval>;

    intervalId = setInterval(() => {
        if (_landed) { clearInterval(intervalId); return; }
        t += dt;

        const phase = Math.min(t / 80, 1);
        const alt = Math.sin(phase * Math.PI) * 12000;
        if (alt > _maxAlt) _maxAlt = alt;

        const vSpeed = Math.cos(phase * Math.PI) * 350 + (Math.random() - 0.5) * 5;

        currentAltitude.set(alt);
        maxAltitude.set(_maxAlt);
        flightDuration.set(t);
        flightSpeed.set(Math.abs(Math.cos(phase * Math.PI) * 600 + Math.random() * 10));
        verticalSpeed.set(vSpeed);
        acceleration.set(-Math.sin(phase * Math.PI) * 30 + (Math.random() - 0.5) * 2);
        fuelUsed.set(Math.min(phase * config.fuelCapacity * 0.85, config.fuelCapacity));
        downrangeDistance.set(phase * 45 + (Math.random() - 0.5) * 0.1);
        apogeeEta.set(Math.max(0, 40 - t + (Math.random() - 0.5) * 1));

        if (onPhaseChange) {
            if (t < config.burnTime) {
                onPhaseChange("BOOST");
            } else if (alt <= 200 && phase > 0.5) {
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
