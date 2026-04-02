import { writable } from "svelte/store";

export const connected = writable(false);
export const dataRate = writable(0);   // msg/s — counted from incoming messages

export function startTelemetrySimulation(): () => void {
    connected.set(true);
    let msgCount = 0;

    const signalInterval = setInterval(() => {
        msgCount += Math.floor(8 + Math.random() * 6);
    }, 100);

    const rateInterval = setInterval(() => {
        dataRate.set(msgCount);
        msgCount = 0;
    }, 1000);

    return () => {
        clearInterval(signalInterval);
        clearInterval(rateInterval);
        connected.set(false);
    };
}
