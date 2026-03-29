import { writable } from "svelte/store";

// MAVLink ATTITUDE (#30)
export const roll = writable(0);      // deg
export const pitch = writable(0);     // deg
export const yaw = writable(0);       // deg 0–360
export const rollRate = writable(0);  // deg/s
export const pitchRate = writable(0); // deg/s
export const yawRate = writable(0);   // deg/s

// MAVLink SCALED_IMU (#26)
export const accX = writable(0);  // m/s²
export const accY = writable(0);  // m/s²
export const accZ = writable(0);  // m/s²
export const gyroX = writable(0); // deg/s
export const gyroY = writable(0); // deg/s
export const gyroZ = writable(0); // deg/s
export const magX = writable(0);  // mGauss
export const magY = writable(0);  // mGauss
export const magZ = writable(0);  // mGauss

const G = 9.80665;

export function startImuSimulation(): () => void {
    let t = 0;
    let _roll = 0, _pitch = 0, _yaw = 0;
    let prevRoll = 0, prevPitch = 0;
    const dt = 0.05;

    const interval = setInterval(() => {
        t += dt;
        prevRoll = _roll;
        prevPitch = _pitch;

        _roll = Math.sin(t * 0.5) * 45;
        _pitch = Math.cos(t * 0.3) * 30;
        _yaw = (_yaw + 0.5) % 360;

        const _rollRate = (_roll - prevRoll) / dt;
        const _pitchRate = (_pitch - prevPitch) / dt;
        const _yawRate = 10;

        const rr = (_roll * Math.PI) / 180;
        const pr = (_pitch * Math.PI) / 180;
        const yr = (_yaw * Math.PI) / 180;

        roll.set(_roll);
        pitch.set(_pitch);
        yaw.set(_yaw);
        rollRate.set(_rollRate);
        pitchRate.set(_pitchRate);
        yawRate.set(_yawRate);

        accX.set(-Math.sin(pr) * G + (Math.random() - 0.5) * 0.15);
        accY.set(Math.sin(rr) * Math.cos(pr) * G + (Math.random() - 0.5) * 0.15);
        accZ.set(Math.cos(rr) * Math.cos(pr) * G + (Math.random() - 0.5) * 0.15);

        gyroX.set(_rollRate + (Math.random() - 0.5) * 1.0);
        gyroY.set(_pitchRate + (Math.random() - 0.5) * 1.0);
        gyroZ.set(_yawRate + (Math.random() - 0.5) * 1.0);

        magX.set(Math.cos(yr) * 250 + (Math.random() - 0.5) * 8);
        magY.set(Math.sin(yr) * 250 + (Math.random() - 0.5) * 8);
        magZ.set(-400 + (Math.random() - 0.5) * 8);
    }, 50);

    return () => clearInterval(interval);
}
