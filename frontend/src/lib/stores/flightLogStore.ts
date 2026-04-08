/**
 * flightLogStore.ts
 * Collects telemetry + events during a flight and saves a JSON log on LANDED.
 */
import { get } from "svelte/store";
import { flightPhase, simConfig, countdownDuration } from "./simulationControl";
import { trail } from "./trajectoryStore";
import { imuSource } from "./imuSource";
import {
    maxAltitude,
    verticalSpeed,
    flightDuration,
    downrangeDistance,
} from "./flightStore";
import { SaveFlightLog } from "../../../wailsjs/go/main/App";

export interface FlightEvent {
    t: number;
    phase: string;
}

export interface FlightLogSummary {
    maxAltitude: number;
    maxVerticalSpeed: number;
    flightDuration: number;
    downrangeDistance: number;
}

export interface FlightLog {
    meta: {
        id: string;
        date: string;
        source: string;
    };
    config: {
        altitudeAbs: number;
        altitudeRel: number;
        pitch: number;
        roll: number;
        yaw: number;
        lat: number;
        lon: number;
        dryMass: number;
        fuelMass: number;
        thrust: number;
        burnTime: number;
        countdownDuration: number;
        nozzleType: string;
        thrustEfficiency: number;
        nozzleMass: number;
    };
    events: FlightEvent[];
    summary: FlightLogSummary;
    telemetry: Array<{ t: number; alt: number; vz: number }>;
}

let events: FlightEvent[] = [];
let peakVz = 0;
let phaseStartTime = 0;
let watchActive = false;
let unsub: (() => void) | null = null;

/** Call once on app start to wire up the auto-save listener. */
export function initFlightLogger(): void {
    if (unsub) unsub();

    unsub = flightPhase.subscribe((phase) => {
        if (phase === "BOOST" && !watchActive) {
            // Flight started — reset accumulators
            events = [];
            peakVz = 0;
            phaseStartTime = 0;
            watchActive = true;
        }

        if (watchActive) {
            const trailData = get(trail);
            const currentT = trailData.length > 0 ? trailData[trailData.length - 1].t : 0;

            // Track peak vertical speed
            const vz = get(verticalSpeed);
            if (vz > peakVz) peakVz = vz;

            // Record phase event
            events.push({ t: currentT, phase });

            if (phase === "LANDED") {
                watchActive = false;
                _saveLog();
            }

            if (phase === "STANDBY" || phase === "ABORTED") {
                watchActive = false;
                events = [];
            }
        }
    });
}

async function _saveLog(): Promise<void> {
    const cfg = get(simConfig);
    const trailData = get(trail);
    const now = new Date();
    const id = `flight_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;

    const log: FlightLog = {
        meta: {
            id,
            date: now.toISOString(),
            source: get(imuSource),
        },
        config: {
            altitudeAbs: cfg.altitudeAbs,
            altitudeRel: cfg.altitudeRel,
            pitch: cfg.pitch,
            roll: cfg.roll,
            yaw: cfg.yaw,
            lat: cfg.lat,
            lon: cfg.lon,
            dryMass: cfg.dryMass,
            fuelMass: cfg.fuelMass,
            thrust: cfg.thrust,
            burnTime: cfg.burnTime,
            countdownDuration: get(countdownDuration),
            nozzleType: cfg.nozzleType,
            thrustEfficiency: cfg.thrustEfficiency,
            nozzleMass: cfg.nozzleMass,
        },
        events,
        summary: {
            maxAltitude: get(maxAltitude),
            maxVerticalSpeed: peakVz,
            flightDuration: get(flightDuration),
            downrangeDistance: get(downrangeDistance),
        },
        telemetry: trailData.map((p) => ({ t: p.t, alt: p.alt, vz: p.vz })),
    };

    try {
        await SaveFlightLog(JSON.stringify(log, null, 2));
    } catch (e) {
        console.error("Failed to save flight log:", e);
    }
}
