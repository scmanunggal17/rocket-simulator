import { writable } from "svelte/store";

/** "sim" = SIMULATION mode (app generates data), "real" = CONTROLLER mode (serial data) */
export const imuSource = writable<"sim" | "real">("sim");
