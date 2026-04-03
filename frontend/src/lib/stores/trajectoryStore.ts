import { writable } from "svelte/store";

export interface TrailPoint {
    t: number;
    alt: number;
    vz: number;
}

/** Persistent trail data that survives tab switches */
export const trail = writable<TrailPoint[]>([]);
export const missionTime = writable(0);

export function clearTrajectory(): void {
    trail.set([]);
    missionTime.set(0);
}
