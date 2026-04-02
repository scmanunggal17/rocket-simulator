import { writable, get } from "svelte/store";
import { imuSource } from "./imuSource";
import { pitch, roll, yaw, rollRate, pitchRate, yawRate, accX, accY, accZ, gyroX, gyroY, gyroZ } from "./imuStore";
import {
    startFlightSimulation,
    fuelCapacity, fuelUsed, maxAltitude, currentAltitude, absoluteAltitude,
    flightDuration, flightSpeed, verticalSpeed, acceleration,
    downrangeDistance, apogeeEta,
} from "./flightStore";

export type FlightPhase = "STANDBY" | "READY" | "COUNTDOWN" | "BOOST" | "COAST" | "APOGEE" | "DESCENT" | "LANDED" | "ABORTED";

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
    pitch.set(config.launchAngle);
    roll.set(0);
    yaw.set(0);
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
    absoluteAltitude.set(0);
    flightDuration.set(0);
    flightSpeed.set(0);
    verticalSpeed.set(0);
    acceleration.set(0);
    downrangeDistance.set(0);
    apogeeEta.set(40);
    fuelCapacity.set(currentConfig.fuelCapacity);

    stopFns = [
        startFlightSimulation(currentConfig, (phase) => {
            flightPhase.set(phase as FlightPhase);
            if (phase === "LANDED") {
                simulating.set(false);
            }
        }),
    ];
    simulating.set(true);
}

function _clearFlightStores(): void {
    currentAltitude.set(0);
    absoluteAltitude.set(0);
    verticalSpeed.set(0);
    flightSpeed.set(0);
    acceleration.set(0);
    maxAltitude.set(0);
    fuelUsed.set(0);
    flightDuration.set(0);
    downrangeDistance.set(0);
    apogeeEta.set(0);
    pitch.set(0); roll.set(0); yaw.set(0);
    pitchRate.set(0); rollRate.set(0); yawRate.set(0);
    accX.set(0); accY.set(0); accZ.set(0);
    gyroX.set(0); gyroY.set(0); gyroZ.set(0);
}

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
    flightPhase.set("ABORTED");
    _clearFlightStores();
}

export function resetSimulation(): void {
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
    stopFns.forEach((fn) => fn());
    stopFns = [];
    countdown.set(null);
    simulating.set(false);
    configured.set(false);
    _clearFlightStores();
    flightPhase.set("STANDBY");
}

