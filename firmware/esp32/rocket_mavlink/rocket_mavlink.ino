/*
 * Rocket GCS — ESP32 Serial CSV Telemetry Simulator
 * ─────────────────────────────────────────────────────────────────────────────
 * Generates smooth, realistic rocket flight data over USB Serial.
 * Data ramps gradually between phases — no random jumps.
 *
 * CSV format (one line per sample, 10 Hz):
 *   altitude_abs, altitude_rel, pitch, roll, yaw, latitude, longitude
 *
 * Flight phases:
 *   PAD (3s) → BOOST (4s) → COAST (12s) → DROGUE (36s) → MAIN (40s) → LANDED
 *
 * Requirements:
 *   - Arduino Nano V3 (ATmega328P)
 *   - USB cable to PC
 *   - Arduino IDE
 * ─────────────────────────────────────────────────────────────────────────────
 */

#include <Arduino.h>
#include <math.h>

// ── Configuration ────────────────────────────────────────────────────────────
#define SERIAL_BAUD  115200
#define SEND_RATE_HZ 10
#define SEND_DT      (1.0f / SEND_RATE_HZ)

// ── Launch site ──────────────────────────────────────────────────────────────
#define LAUNCH_LAT    -7.800000f
#define LAUNCH_LON   110.370000f
#define LAUNCH_ALT   142.0f   // ASL (m)

// ── Flight timeline (seconds after ignition) ─────────────────────────────────
#define T_PAD        3.0f     // sit on pad before ignition
#define T_BURNOUT    7.0f     // ignition at 3s, burnout at 7s (4s burn)
#define T_APOGEE    19.0f     // coast to apogee
#define T_MAIN      55.0f     // drogue descent
#define T_LAND      95.0f     // main chute to landing

// ── Flight parameters ────────────────────────────────────────────────────────
#define V_BURNOUT   180.0f    // vertical speed at burnout (m/s)
#define ALT_APOGEE 1400.0f    // max altitude AGL (m)
#define V_DROGUE     28.0f    // descent rate under drogue (m/s)
#define V_MAIN        5.0f    // descent rate under main (m/s)

// ── State ────────────────────────────────────────────────────────────────────
static float t = 0.0f;
static bool  running = false;
static unsigned long lastSend = 0;

// Smoothed state (updated incrementally for smooth transitions)
static float pitch  = 0.0f;
static float roll   = 0.0f;
static float yaw    = 45.0f;

// ── Helpers ──────────────────────────────────────────────────────────────────
// Smoothly move 'current' toward 'target' by at most 'maxStep' per call
static float approach(float current, float target, float maxStep) {
    float diff = target - current;
    if (diff >  maxStep) diff =  maxStep;
    if (diff < -maxStep) diff = -maxStep;
    return current + diff;
}

// Linear interpolation
static float lerp(float a, float b, float frac) {
    if (frac < 0.0f) frac = 0.0f;
    if (frac > 1.0f) frac = 1.0f;
    return a + (b - a) * frac;
}

// ── Altitude model (piecewise physics) ───────────────────────────────────────
static float flightAlt(float tm) {
    if (tm <= T_PAD) return 0.0f;

    float ft = tm - T_PAD; // time since ignition
    float burnDur  = T_BURNOUT - T_PAD;
    float coastDur = T_APOGEE  - T_BURNOUT;

    float accel   = V_BURNOUT / burnDur;
    float altBurn = 0.5f * accel * burnDur * burnDur;
    float cDecel  = V_BURNOUT / coastDur;

    if (tm < T_BURNOUT) {
        // Boost: constant acceleration
        float bt = ft;
        return 0.5f * accel * bt * bt;
    }
    if (tm < T_APOGEE) {
        // Coast: decelerating under gravity
        float ct = tm - T_BURNOUT;
        return altBurn + V_BURNOUT * ct - 0.5f * cDecel * ct * ct;
    }

    float altMain = ALT_APOGEE - V_DROGUE * (T_MAIN - T_APOGEE);

    if (tm < T_MAIN) {
        // Drogue descent
        return ALT_APOGEE - V_DROGUE * (tm - T_APOGEE);
    }
    if (tm < T_LAND) {
        // Main chute descent
        return altMain - V_MAIN * (tm - T_MAIN);
    }
    return 0.0f;
}

// ── GPS model (smooth wind drift along heading) ─────────────────────────────
static float flightLat(float tm) {
    float drift = (tm <= T_PAD) ? 0.0f : fminf(tm - T_PAD, T_LAND - T_PAD);
    return LAUNCH_LAT + (3.5f * drift) / 111000.0f;
}

static float flightLon(float tm) {
    float drift = (tm <= T_PAD) ? 0.0f : fminf(tm - T_PAD, T_LAND - T_PAD);
    return LAUNCH_LON + (1.8f * drift) / (111000.0f * 0.9907f);
}

// ── Attitude update (smooth ramping, no random jumps) ────────────────────────
void updateAttitude() {
    float targetPitch, targetRoll, yawRate;

    if (t <= T_PAD) {
        // On pad: vertical, stationary
        targetPitch = 0.0f;
        targetRoll  = 0.0f;
        yawRate     = 0.0f;
    }
    else if (t < T_BURNOUT) {
        // Boost: pitch ramps from 0 to ~85 (nearly vertical flight)
        float phase = (t - T_PAD) / (T_BURNOUT - T_PAD);
        targetPitch = lerp(0.0f, 85.0f, phase);
        targetRoll  = phase * 8.0f;  // slight roll buildup
        yawRate     = 0.3f;
    }
    else if (t < T_APOGEE) {
        // Coast: pitch slowly decreases as rocket tips over
        float phase = (t - T_BURNOUT) / (T_APOGEE - T_BURNOUT);
        targetPitch = lerp(85.0f, 45.0f, phase);
        targetRoll  = lerp(8.0f, 15.0f, phase);
        yawRate     = 0.15f;
    }
    else if (t < T_MAIN) {
        // Drogue: pitch settles toward 0 (hanging vertical), some sway
        float phase = (t - T_APOGEE) / (T_MAIN - T_APOGEE);
        float sway  = sinf(t * 0.4f) * (8.0f * (1.0f - phase));
        targetPitch = lerp(45.0f, 2.0f, phase) + sway;
        targetRoll  = sinf(t * 0.3f) * (10.0f * (1.0f - phase));
        yawRate     = 0.6f;  // spinning under drogue
    }
    else if (t < T_LAND) {
        // Main chute: very stable, gentle sway
        float phase = (t - T_MAIN) / (T_LAND - T_MAIN);
        targetPitch = sinf(t * 0.25f) * (3.0f * (1.0f - phase));
        targetRoll  = sinf(t * 0.2f) * (2.0f * (1.0f - phase));
        yawRate     = 0.1f;
    }
    else {
        // Landed: everything settles to 0
        targetPitch = 0.0f;
        targetRoll  = 0.0f;
        yawRate     = 0.0f;
    }

    // Smooth approach — max change per tick keeps data rational
    float maxPitchStep = 2.0f;  // max 2 deg per tick (20 deg/s at 10Hz)
    float maxRollStep  = 1.5f;
    pitch = approach(pitch, targetPitch, maxPitchStep);
    roll  = approach(roll,  targetRoll,  maxRollStep);
    yaw   = fmodf(yaw + yawRate, 360.0f);
}

// ── Arduino ──────────────────────────────────────────────────────────────────
void setup() {
    Serial.begin(SERIAL_BAUD);
    delay(200);
    running = true;
    t = 0.0f;
    pitch = 0.0f;
    roll  = 0.0f;
    yaw   = 45.0f;
}

void loop() {
    unsigned long now = millis();
    if (now - lastSend < (1000 / SEND_RATE_HZ)) return;
    lastSend = now;

    t += SEND_DT;

    updateAttitude();

    float altRel = flightAlt(t);
    float altAbs = LAUNCH_ALT + altRel;
    float lat    = flightLat(t);
    float lon    = flightLon(t);

    // CSV: altAbs, altRel, pitch, roll, yaw, lat, lon
    Serial.print(altAbs, 2);   Serial.print(',');
    Serial.print(altRel, 2);   Serial.print(',');
    Serial.print(pitch, 2);    Serial.print(',');
    Serial.print(roll, 2);     Serial.print(',');
    Serial.print(yaw, 2);      Serial.print(',');
    Serial.print(lat, 6);      Serial.print(',');
    Serial.println(lon, 6);

    // Loop flight: restart after landing + 5s pause
    if (t > T_LAND + 5.0f) {
        t     = 0.0f;
        pitch = 0.0f;
        roll  = 0.0f;
        yaw   = 45.0f;
    }
}
