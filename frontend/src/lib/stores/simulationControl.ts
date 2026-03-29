import { writable, get } from "svelte/store";
import { imuSource } from "./imuSource";
import { pitch, roll, yaw, rollRate, pitchRate, yawRate, accX, accY, accZ, gyroX, gyroY, gyroZ } from "./imuStore";
import { ArmRocket, DisarmRocket, LaunchRocket, AbortRocket } from "../../../wailsjs/go/main/App";
import {
    startFlightSimulation,
    fuelCapacity, fuelUsed, maxAltitude, currentAltitude,
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
export const armed = writable(false);
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
    // Preview the launch angle on the rocket drawing immediately
    pitch.set(config.launchAngle);
    roll.set(0);
    yaw.set(0);
}

export function unconfigureSimulation(): void {
    _disarm();
    configured.set(false);
    flightPhase.set("STANDBY");
}

/** Arm the rocket: sets local safety state and sends ARM command to ESP32. */
export function armRocket(): void {
    armed.set(true);
    ArmRocket().catch(() => { });
}

/** Internal disarm — shared by all code paths that need to disarm. */
function _disarm(): void {
    if (!get(armed)) return;
    armed.set(false);
    DisarmRocket().catch(() => { });
}

/** Disarm the rocket: clears local safety state and sends DISARM command to ESP32. */
export function disarmRocket(): void {
    _disarm();
}

export function launchSimulation(): void {
    if (stopFns.length > 0 || countdownTimer) return;
    if (!get(armed)) return;  // safety: must be armed before launching

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
        startFlightSimulation(currentConfig, (phase) => {
            flightPhase.set(phase as FlightPhase);
            if (phase === "LANDED") {
                simulating.set(false);
                _disarm();  // auto-disarm at end of flight
            }
        }),
    ];
    simulating.set(true);
    // Send MAVLink MAV_CMD_MISSION_START (300): rocket is already armed, this triggers flight.
    LaunchRocket().catch(() => { });
}

/** Zero all flight telemetry and IMU stores so the drawing resets cleanly. */
function _clearFlightStores(): void {
    currentAltitude.set(0);
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
    flightPhase.set("ABORTED");
    _clearFlightStores();
    _disarm();
    AbortRocket().catch(() => { });
}

/** Called after LANDED to return to STANDBY for a new launch. */
export function resetSimulation(): void {
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
    stopFns.forEach((fn) => fn());
    stopFns = [];
    countdown.set(null);
    simulating.set(false);
    configured.set(false);
    _clearFlightStores();
    _disarm();
    flightPhase.set("STANDBY");
}

