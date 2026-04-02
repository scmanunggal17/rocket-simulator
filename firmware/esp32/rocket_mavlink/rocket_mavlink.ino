/*
 * Rocket GCS — ESP32 Serial CSV Telemetry Firmware
 * ─────────────────────────────────────────────────────────────────────────────
 * Generates simulated rocket flight data and transmits it as CSV over USB
 * Serial to the Rocket GCS desktop application.
 *
 * CSV format (one line per sample):
 *   altitude_abs, altitude_rel, pitch, roll, yaw, latitude, longitude
 *
 * Example:
 *   154.96,12.22,68.31,-1.25,187.81,-7.777593,110.440867
 *
 * Requirements:
 *   - ESP32 board (any variant)
 *   - USB cable connected to PC
 *   - Arduino IDE with ESP32 board support >= 2.0
 *
 * Setup:
 *   1. Flash the ESP32.
 *   2. Connect USB to Windows PC.
 *   3. In the GCS app select the COM port and click CONNECT.
 * ─────────────────────────────────────────────────────────────────────────────
 */

#include <Arduino.h>
#include <math.h>

// ── User configuration ───────────────────────────────────────────────────────
#define SERIAL_BAUD  115200
#define SEND_RATE_HZ 10      // CSV output rate
// ─────────────────────────────────────────────────────────────────────────────

static const float G       = 9.80665f;
static const float DEG2RAD = (float)M_PI / 180.0f;

// ── Launch site ──────────────────────────────────────────────────────────────
#define LAUNCH_LAT    -7.800000f
#define LAUNCH_LON   110.370000f
#define LAUNCH_ALT   142.0f      // launch site altitude ASL (m)

// ── Flight timeline (seconds from ignition) ──────────────────────────────────
#define T_BURNOUT     3.8f
#define T_APOGEE     15.5f
#define T_MAIN       51.0f
#define T_LAND       94.0f

#define V_BURNOUT   200.0f
#define ALT_APOGEE 1550.0f
#define V_DROGUE     35.0f
#define V_MAIN        7.0f

// ── Flight state ─────────────────────────────────────────────────────────────
static bool  flightActive = false;
static float t            = 0.0f;
static float yawDeg       = 45.0f;
static float rollDeg      = 0.0f;
static float rollAccum    = 0.0f;
static float pitchDeg     = 89.0f;

// ── Piecewise flight model ───────────────────────────────────────────────────
static float flightAlt(float tm) {
    const float accel   = V_BURNOUT / T_BURNOUT;
    const float altBurn = 0.5f * accel * T_BURNOUT * T_BURNOUT;
    const float cDur    = T_APOGEE - T_BURNOUT;
    const float cDecel  = V_BURNOUT / cDur;
    const float altMain = ALT_APOGEE - V_DROGUE * (T_MAIN - T_APOGEE);

    if (tm <= 0.0f)      return 0.0f;
    if (tm < T_BURNOUT)  return 0.5f * accel * tm * tm;
    if (tm < T_APOGEE) { float tc = tm - T_BURNOUT;
                         return altBurn + V_BURNOUT * tc - 0.5f * cDecel * tc * tc; }
    if (tm < T_MAIN)     return ALT_APOGEE - V_DROGUE * (tm - T_APOGEE);
    if (tm < T_LAND)     return altMain    - V_MAIN   * (tm - T_MAIN);
    return 0.0f;
}

// GPS: constant wind drift
static float flightLat(float tm) {
    return LAUNCH_LAT + (4.0f * fminf(tm, T_LAND)) / 111000.0f;
}
static float flightLon(float tm) {
    return LAUNCH_LON + (2.0f * fminf(tm, T_LAND)) / (111000.0f * 0.9907f);
}

// ── Attitude simulation ─────────────────────────────────────────────────────
void updateAttitude() {
    const float dt = 1.0f / SEND_RATE_HZ;
    float rollRateDeg;

    if (!flightActive) {
        pitchDeg    = 89.5f;
        rollRateDeg = 0.0f;
    } else if (t < T_BURNOUT) {
        pitchDeg    = 89.0f - (t / T_BURNOUT) * 2.0f + sinf(t * 5.0f) * 0.4f;
        rollRateDeg = 30.0f;
        yawDeg      = fmodf(yawDeg + 0.3f, 360.0f);
    } else if (t < T_APOGEE) {
        float ph = (t - T_BURNOUT) / (T_APOGEE - T_BURNOUT);
        pitchDeg    = 87.0f - ph * 8.0f + sinf(t * 1.8f) * 1.2f;
        rollRateDeg = 30.0f * (1.0f - ph) + 4.0f;
        yawDeg      = fmodf(yawDeg + 0.1f, 360.0f);
    } else if (t < T_MAIN) {
        float ph = (t - T_APOGEE) / (T_MAIN - T_APOGEE);
        pitchDeg    = 79.0f * (1.0f - ph) + sinf(t * 3.0f) * (12.0f * (1.0f - ph));
        rollRateDeg = 80.0f * (1.0f - ph) + 5.0f;
        yawDeg      = fmodf(yawDeg + 0.8f, 360.0f);
    } else if (t < T_LAND) {
        pitchDeg    = sinf(t * 0.65f) * 5.0f;
        rollRateDeg = 4.0f;
        yawDeg      = fmodf(yawDeg + 0.15f, 360.0f);
    } else {
        pitchDeg    = 0.0f;
        rollRateDeg = 0.0f;
    }

    rollAccum += rollRateDeg * dt;
    rollDeg    = fmodf(rollAccum, 360.0f);
}

// ── Arduino setup / loop ─────────────────────────────────────────────────────
static unsigned long lastSend = 0;
static const unsigned long sendInterval = 1000 / SEND_RATE_HZ;

void setup() {
    Serial.begin(SERIAL_BAUD);
    delay(200);

    // Auto-start flight after 3 seconds (simulated launch)
    flightActive = true;
    t = 0.0f;
    rollAccum = 0.0f;
    yawDeg = 45.0f;
    pitchDeg = 89.0f;
}

void loop() {
    unsigned long now = millis();

    if (now - lastSend >= sendInterval) {
        lastSend = now;

        if (flightActive) {
            t += 1.0f / SEND_RATE_HZ;
            if (t > T_LAND) {
                flightActive = false;
            }
        }

        updateAttitude();

        float altRel = flightAlt(t);
        float altAbs = LAUNCH_ALT + altRel;
        float lat    = flightLat(t);
        float lon    = flightLon(t);

        // CSV: altAbs, altRel, pitch, roll, yaw, lat, lon
        Serial.print(altAbs, 2);     Serial.print(',');
        Serial.print(altRel, 2);     Serial.print(',');
        Serial.print(pitchDeg, 2);   Serial.print(',');
        Serial.print(rollDeg, 2);    Serial.print(',');
        Serial.print(yawDeg, 2);     Serial.print(',');
        Serial.print(lat, 6);        Serial.print(',');
        Serial.println(lon, 6);
    }
}
