import { writable } from "svelte/store";

// MAVLink RADIO_STATUS (#109)
export const rssi = writable(0);   // 0–100 %
export const noise = writable(0); // 0–100 %

// Derived / computed
export const connected = writable(false);
export const dataRate = writable(0);   // msg/s — counted from incoming messages

export function startTelemetrySimulation(): () => void {
    let msgCount = 0;

    // Simulate HEARTBEAT arriving at 1 Hz → connected
    connected.set(true);

    const signalInterval = setInterval(() => {
        // Simulate RSSI with gentle drift
        rssi.update((v) => Math.min(100, Math.max(20, v + (Math.random() - 0.48) * 3)));
        noise.update((v) => Math.min(40, Math.max(2, v + (Math.random() - 0.5) * 1.5)));
        msgCount += Math.floor(8 + Math.random() * 6); // simulate ~10 msgs/100ms
    }, 100);

    // Update data rate every second
    const rateInterval = setInterval(() => {
        dataRate.set(msgCount);
        msgCount = 0;
    }, 1000);

    // Seed initial values
    rssi.set(78);
    noise.set(12);

    return () => {
        clearInterval(signalInterval);
        clearInterval(rateInterval);
        connected.set(false);
    };
}
