import { writable, get } from "svelte/store";
import { pitch, roll, yaw, rollRate, pitchRate, yawRate, accX, accY, accZ, gyroX, gyroY, gyroZ } from "./imuStore";
import {
    startFlightSimulation,
    fuelCapacity, fuelUsed, maxAltitude, currentAltitude, absoluteAltitude,
    flightDuration, flightSpeed, verticalSpeed, acceleration,
    downrangeDistance, apogeeEta, rocketLat, rocketLon,
} from "./flightStore";
import type { SimInitialValues } from "./flightStore";
import { clearTrajectory } from "./trajectoryStore";
import { imuSource } from "./imuSource";
import { lastSerialData } from "./telemetryStore";

export type FlightPhase = "STANDBY" | "READY" | "COUNTDOWN" | "BOOST" | "COAST" | "APOGEE" | "DESCENT" | "LANDED" | "ABORTED";

export const simulating = writable(false);
export const configured = writable(false);
export const flightPhase = writable<FlightPhase>("STANDBY");
export const countdown = writable<number | null>(null);
export const countdownDuration = writable<number>(10);
export const simConfig = writable<SimInitialValues>({
    altitudeAbs: 100,
    altitudeRel: 0,
    pitch: 45,
    roll: 0,
    yaw: 0,
    lat: -7.800000,
    lon: 110.370000,
    dryMass: 10,
    thrust: 300,
    burnTime: 5,
    fuelMass: 3,
});

let stopFns: (() => void)[] = [];
let countdownTimer: ReturnType<typeof setInterval> | null = null;
let currentConfig: SimInitialValues = {
    altitudeAbs: 100, altitudeRel: 0, pitch: 45, roll: 0, yaw: 0,
    lat: -7.800000, lon: 110.370000, dryMass: 10, thrust: 300, burnTime: 5, fuelMass: 3,
};

export function configureSimulation(config: SimInitialValues): void {
    currentConfig = config;
    simConfig.set(config);
    configured.set(true);
    flightPhase.set("READY");
    pitch.set(config.pitch);
    roll.set(config.roll);
    yaw.set(config.yaw);
    absoluteAltitude.set(config.altitudeAbs);
    currentAltitude.set(config.altitudeRel);
    rocketLat.set(config.lat);
    rocketLon.set(config.lon);
}

/**
 * Controller mode: save rocket specs and mark READY.
 * Resets telemetry fields in simConfig so SIM values never leak into controller launches.
 */
export function configureControllerSpecs(specs: { dryMass: number; thrust: number; burnTime: number; fuelMass: number }): void {
    simConfig.set({
        altitudeAbs: 0, altitudeRel: 0,
        pitch: 0, roll: 0, yaw: 0,
        lat: 0, lon: 0,
        ...specs,
    });
    configured.set(true);
    flightPhase.set("READY");
}

export function unconfigureSimulation(): void {
    configured.set(false);
    flightPhase.set("STANDBY");
}

export function launchSimulation(): void {
    if (stopFns.length > 0 || countdownTimer) return;

    let t = get(countdownDuration);
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
    currentAltitude.set(currentConfig.altitudeRel);
    absoluteAltitude.set(currentConfig.altitudeAbs);
    rocketLat.set(currentConfig.lat);
    rocketLon.set(currentConfig.lon);
    pitch.set(currentConfig.pitch);
    roll.set(currentConfig.roll);
    yaw.set(currentConfig.yaw);
    flightDuration.set(0);
    flightSpeed.set(0);
    verticalSpeed.set(0);
    acceleration.set(0);
    downrangeDistance.set(0);
    apogeeEta.set(40);

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
    rocketLat.set(null);
    rocketLon.set(null);
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
    clearTrajectory();
    flightPhase.set("STANDBY");
}

/**
 * Launch simulation using the last controller data as initial values.
 * Uses raw serial data ONLY for telemetry — never falls back to simConfig.
 * Rocket specs come from simConfig.
 */
export function launchFromController(): void {
    if (stopFns.length > 0 || countdownTimer) return;

    const serial = get(lastSerialData);
    if (!serial) return; // no controller data available

    const cfg = get(simConfig);
    const liveControllerPitch = get(pitch);
    currentConfig = {
        // Telemetry: strictly from last controller data
        altitudeAbs: serial.altitudeAbs,
        altitudeRel: serial.altitudeRel,
        // Force launch pitch from the current controller-fed IMU store value.
        pitch: liveControllerPitch,
        roll: serial.roll,
        yaw: (serial.yaw + 360) % 360,
        lat: serial.lat,
        lon: serial.lon,
        // Rocket specs: from user input
        dryMass: cfg.dryMass,
        thrust: cfg.thrust,
        burnTime: cfg.burnTime,
        fuelMass: cfg.fuelMass,
    };

    simConfig.set(currentConfig);
    configured.set(true);

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

