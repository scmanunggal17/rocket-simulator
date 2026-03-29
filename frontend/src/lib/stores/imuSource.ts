import { writable } from "svelte/store";

/** "sim" = use simulated IMU data, "real" = use live IMU from ESP32 */
export const imuSource = writable<"sim" | "real">("sim");
