import { writable } from "svelte/store";
import { startImuSimulation } from "./imuStore";
import {
    startFlightSimulation,
    fuelCapacity, fuelUsed, maxAltitude, currentAltitude,
    flightDuration, flightSpeed, verticalSpeed, acceleration,
    downrangeDistance, apogeeEta,
} from "./flightStore";

export type FlightPhase = "STANDBY" | "READY" | "COUNTDOWN" | "BOOST" | "COAST" | "APOGEE" | "DESCENT" | "LANDED";

export interface SimConfig {
    fuelCapacity: number;   // kg
    launchAngle: number;    // deg
    thrust: number;         // N
    burnTime: number;       // s
}

export const simulating = writable(false);
export const configured = writable(false);
export const flightPhase = writable<FlightPhase>("STANDBY");
export const countdown = writable<number | null>(null);
export const simConfig = writable<SimConfig>({
    fuelCapacity: 450,
    launchAngle: 90,
    thrust: 5000,
    burnTime: 8,
});

let stopFns: (() => void)[] = [];
let countdownTimer: ReturnType<typeof setInterval> | null = null;
let currentConfig: SimConfig = { fuelCapacity: 450, launchAngle: 90, thrust: 5000, burnTime: 8 };

export function configureSimulation(config: SimConfig): void {
    currentConfig = config;
    simConfig.set(config);
    configured.set(true);
    flightPhase.set("READY");
}

export function unconfigureSimulation(): void {
    configured.set(false);
    flightPhase.set("STANDBY");
}

export function launchSimulation(): void {
    if (stopFns.length > 0 || countdownTimer) return;

    let t = 5;
    countdown.set(t);
    flightPhase.set("COUNTDOWN");

    countdownTimer = setInterval(() => {
        t--;
        if (t > 0) {
            countdown.set(t);
        } else {
            clearInterval(countdownTimer!);
            countdownTimer = null;
            countdown.set(null);
            _launch();
        }
    }, 1000);
}

function _launch(): void {
    fuelUsed.set(0);
    maxAltitude.set(0);
    currentAltitude.set(0);
    flightDuration.set(0);
    flightSpeed.set(0);
    verticalSpeed.set(0);
    acceleration.set(0);
    downrangeDistance.set(0);
    apogeeEta.set(40);
    fuelCapacity.set(currentConfig.fuelCapacity);

    stopFns = [
        startImuSimulation(),
        startFlightSimulation(currentConfig, (phase) => {
            flightPhase.set(phase as FlightPhase);
            if (phase === "LANDED") {
                simulating.set(false);
            }
        }),
    ];
    simulating.set(true);
}

/** Abort during countdown → back to READY. Abort during flight → STANDBY. */
export function abortSimulation(): void {
    if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
        countdown.set(null);
        flightPhase.set("READY");
        return;
    }
    stopFns.forEach((fn) => fn());
    stopFns = [];
    simulating.set(false);
    configured.set(false);
    flightPhase.set("STANDBY");
}

/** Called after LANDED to return to STANDBY for a new launch. */
export function resetSimulation(): void {
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
    stopFns.forEach((fn) => fn());
    stopFns = [];
    countdown.set(null);
    simulating.set(false);
    configured.set(false);
    flightPhase.set("STANDBY");
}

