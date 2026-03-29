/*
 * Rocket GCS — ESP32 MAVLink Fake Sensor Firmware
 * ─────────────────────────────────────────────────────────────────────────────
 * Generates simulated rocket flight data and transmits it as real MAVLink v1
 * messages over Wi-Fi TCP to the Rocket GCS desktop application.
 *
 * Messages sent:
 *   - HEARTBEAT        (#0)   @ 1 Hz
 *   - SCALED_IMU       (#26)  @ 20 Hz
 *   - ATTITUDE         (#30)  @ 20 Hz
 *   - GLOBAL_POSITION_INT (#33) @ 10 Hz
 *   - VFR_HUD          (#74)  @ 10 Hz
 *   - RADIO_STATUS     (#109) @  1 Hz
 *
 * Requirements:
 *   - ESP32 board (any variant)
 *   - Arduino IDE with ESP32 board support >= 2.0
 *   - No external libraries required (MAVLink v1 packed from scratch)
 *
 * Setup:
 *   1. Optionally change AP_SSID / AP_PASS below.
 *   2. Connect your PC to the ESP32's Wi-Fi hotspot (SSID: gcs).
 *   3. In the GCS app click CONNECT — it dials TCP 192.168.4.1:5760.
 *   4. Flash the ESP32 and open Serial Monitor at 115200 baud to see status.
 * ─────────────────────────────────────────────────────────────────────────────
 */

#include <Arduino.h>
#include <WiFi.h>
#include <math.h>

// ── User configuration ───────────────────────────────────────────────────────
#define AP_SSID     "gcs"       // Hotspot name broadcast by the ESP32
#define AP_PASS     "rocketgcs"       // Hotspot password (min 8 chars, or "" for open)
#define TCP_PORT    5760              // Standard MAVLink TCP port
// ─────────────────────────────────────────────────────────────────────────────

#define SYS_ID    1
#define COMP_ID   1

// CRC_EXTRA bytes (MAVLink common dialect, do not change)
#define X_HEARTBEAT        50
#define X_SCALED_IMU      170
#define X_ATTITUDE         39
#define X_GLOBAL_POS_INT  104
#define X_VFR_HUD          20
#define X_RADIO_STATUS    185

static WiFiServer tcpServer(TCP_PORT);
static WiFiClient tcpClient;
static uint8_t   seq  = 0;
static uint8_t  txBuf[300];

// ── Helpers ──────────────────────────────────────────────────────────────────
static float clampf(float v, float lo, float hi) {
    return v < lo ? lo : (v > hi ? hi : v);
}

// little-endian writers
static void pu32(uint8_t* b, uint32_t v){ b[0]=v;b[1]=v>>8;b[2]=v>>16;b[3]=v>>24; }
static void pi32(uint8_t* b, int32_t  v){ pu32(b,(uint32_t)v); }
static void pu16(uint8_t* b, uint16_t v){ b[0]=v;b[1]=v>>8; }
static void pi16(uint8_t* b, int16_t  v){ pu16(b,(uint16_t)v); }
static void pf32(uint8_t* b, float    v){ memcpy(b,&v,4); }

// ── MAVLink v1 packer ────────────────────────────────────────────────────────
static void crcAcc(uint8_t byte, uint16_t* crc) {
    uint8_t t = byte ^ (uint8_t)(*crc & 0xFF);
    t ^= (t << 4);
    *crc = (*crc >> 8) ^ ((uint16_t)t << 8) ^ ((uint16_t)t << 3) ^ (t >> 4);
}

static void sendMsg(uint8_t msgid, uint8_t crcExtra,
                    const uint8_t* payload, uint8_t plen) {
    txBuf[0] = 0xFE;
    txBuf[1] = plen;
    txBuf[2] = seq++;
    txBuf[3] = SYS_ID;
    txBuf[4] = COMP_ID;
    txBuf[5] = msgid;
    memcpy(&txBuf[6], payload, plen);

    uint16_t crc = 0xFFFF;
    for (int i = 1; i < 6 + plen; i++) crcAcc(txBuf[i], &crc);
    crcAcc(crcExtra, &crc);
    txBuf[6 + plen]     = crc & 0xFF;
    txBuf[6 + plen + 1] = crc >> 8;

    if (tcpClient && tcpClient.connected()) {
        tcpClient.write(txBuf, 8 + plen);
    }
}

// ── Message builders ─────────────────────────────────────────────────────────

void sendHeartbeat() {
    uint8_t p[9] = {};
    p[4] = 2;    // MAV_TYPE_ROCKET
    p[6] = 193;  // MAV_MODE_FLAG_SAFETY_ARMED | CUSTOM_MODE | STABILIZE
    p[7] = 4;    // MAV_STATE_ACTIVE
    p[8] = 3;    // MAVLink version
    sendMsg(0, X_HEARTBEAT, p, 9);
}

void sendAttitude(float roll_rad, float pitch_rad, float yaw_rad,
                  float p_rad, float q_rad, float r_rad) {
    uint8_t p[28];
    pu32(p,    millis());
    pf32(p+4,  roll_rad);
    pf32(p+8,  pitch_rad);
    pf32(p+12, yaw_rad);
    pf32(p+16, p_rad);
    pf32(p+20, q_rad);
    pf32(p+24, r_rad);
    sendMsg(30, X_ATTITUDE, p, 28);
}

void sendScaledImu(float ax, float ay, float az,         // m/s²
                   float gx, float gy, float gz,         // deg/s
                   float mx, float my, float mz) {       // mGauss
    const float G = 9.80665f;
    const float D2R_mrad = (float)M_PI / 180.0f * 1000.0f;
    uint8_t p[22];
    pu32(p, millis());
    pi16(p+4,  (int16_t)(ax * 1000.0f / G));
    pi16(p+6,  (int16_t)(ay * 1000.0f / G));
    pi16(p+8,  (int16_t)(az * 1000.0f / G));
    pi16(p+10, (int16_t)(gx * D2R_mrad));
    pi16(p+12, (int16_t)(gy * D2R_mrad));
    pi16(p+14, (int16_t)(gz * D2R_mrad));
    pi16(p+16, (int16_t)mx);
    pi16(p+18, (int16_t)my);
    pi16(p+20, (int16_t)mz);
    sendMsg(26, X_SCALED_IMU, p, 22);
}

void sendVfrHud(float speed, float alt, float climb,
                int16_t heading_deg, uint16_t throttle_pct) {
    uint8_t p[20];
    pf32(p,    speed);
    pf32(p+4,  speed);   // groundspeed ≈ airspeed for this sim
    pf32(p+8,  alt);
    pf32(p+12, climb);
    pi16(p+16, heading_deg);
    pu16(p+18, throttle_pct);
    sendMsg(74, X_VFR_HUD, p, 20);
}

void sendGlobalPosInt(float lat, float lon, float alt_m, float climb_ms, float hdg_deg) {
    uint8_t p[28];
    pu32(p,    millis());
    pi32(p+4,  (int32_t)(lat * 1e7f));           // lat in 1e-7 deg
    pi32(p+8,  (int32_t)(lon * 1e7f));           // lon in 1e-7 deg
    pi32(p+12, (int32_t)(alt_m * 1000.0f));      // alt MSL mm
    pi32(p+16, (int32_t)(alt_m * 1000.0f));      // relative alt mm
    pi16(p+20, 0);                               // vx cm/s
    pi16(p+22, 0);                               // vy cm/s
    pi16(p+24, (int16_t)(-climb_ms * 100.0f));   // vz cm/s (NED: up = negative)
    pu16(p+26, (uint16_t)(hdg_deg * 100.0f));    // heading cdeg
    sendMsg(33, X_GLOBAL_POS_INT, p, 28);
}

void sendRadioStatus(uint8_t rssi, uint8_t remrssi, uint8_t noise) {
    uint8_t p[9] = {};
    p[0] = rssi;
    p[1] = remrssi;
    p[2] = 100;    // txbuf %
    p[3] = noise;
    p[4] = noise;  // remnoise
    sendMsg(109, X_RADIO_STATUS, p, 9);
}

// ── Flight state ─────────────────────────────────────────────────────────────
static bool  esArmed     = false; // true after GCS sends ARM command
static bool  flightActive = false; // true while simulating; set by MISSION_START command
static float t         = 0.0f;   // mission time (s)
static float yawDeg    = 45.0f;  // initial heading NE
static float rollDeg   = 0.0f;
static float rollAccum = 0.0f;   // unwrapped roll for rate calculation
static float pitchDeg  = 89.0f;  // starts near-vertical
static float rssiVal   = 82.0f;
static float remRssi   = 76.0f;
static float noiseVal  = 10.0f;

static const float G       = 9.80665f;
static const float DEG2RAD = (float)M_PI / 180.0f;

// ── Launch site ───────────────────────────────────────────────────────────────
#define LAUNCH_LAT    -7.800000f    // degrees
#define LAUNCH_LON   110.370000f    // degrees

// ── Flight timeline (seconds from ignition) ───────────────────────────────────
// Mid-power sounding rocket: ~200 m/s burnout, ~1550 m apogee
#define T_BURNOUT     3.8f    // motor cuts out
#define T_APOGEE     15.5f    // apogee, drogue deploys
#define T_MAIN       51.0f    // main chute deploys (~300 m AGL)
#define T_LAND       94.0f    // touchdown

#define V_BURNOUT   200.0f    // m/s at burnout  (≈ Mach 0.6)
#define ALT_APOGEE 1550.0f    // m AGL at apogee
#define V_DROGUE     35.0f    // m/s descent under drogue
#define V_MAIN        7.0f    // m/s descent under main chute

// ── Piecewise flight model ────────────────────────────────────────────────────

// Altitude (m AGL) as a function of mission time
static float flightAlt(float tm) {
    const float accel   = V_BURNOUT / T_BURNOUT;
    const float altBurn = 0.5f * accel * T_BURNOUT * T_BURNOUT;   // ~380 m
    const float cDur    = T_APOGEE - T_BURNOUT;
    const float cDecel  = V_BURNOUT / cDur;
    const float altMain = ALT_APOGEE - V_DROGUE * (T_MAIN - T_APOGEE); // ~305 m

    if (tm <= 0.0f)      return 0.0f;
    if (tm < T_BURNOUT)  return 0.5f * accel * tm * tm;
    if (tm < T_APOGEE) { float tc = tm - T_BURNOUT;
                         return altBurn + V_BURNOUT * tc - 0.5f * cDecel * tc * tc; }
    if (tm < T_MAIN)     return ALT_APOGEE - V_DROGUE * (tm - T_APOGEE);
    if (tm < T_LAND)     return altMain    - V_MAIN   * (tm - T_MAIN);
    return 0.0f;
}

// Vertical speed (m/s, positive = up)
static float flightVZ(float tm) {
    const float cDur   = T_APOGEE - T_BURNOUT;
    const float cDecel = V_BURNOUT / cDur;

    if (tm <= 0.0f)      return 0.0f;
    if (tm < T_BURNOUT)  return (V_BURNOUT / T_BURNOUT) * tm;
    if (tm < T_APOGEE)   return V_BURNOUT - cDecel * (tm - T_BURNOUT);
    if (tm < T_MAIN)     return -V_DROGUE;
    if (tm < T_LAND)     return -V_MAIN;
    return 0.0f;
}

// GPS: constant wind drift — 4 m/s north, 2 m/s east
static float flightLat(float tm) {
    return LAUNCH_LAT + (4.0f * fminf(tm, T_LAND)) / 111000.0f;
}
static float flightLon(float tm) {
    return LAUNCH_LON + (2.0f * fminf(tm, T_LAND)) / (111000.0f * 0.9907f); // cos(-7.8°)
}

// ── Simulation update functions ───────────────────────────────────────────────

// Called at 20 Hz — streams always when a GCS client is connected.
// When not in flight the rocket is on the pad: upright, stationary, 1G on nose axis.
void updateImu() {
    const float dt = 0.05f;
    float prevPitch    = pitchDeg;
    float rollRateDeg;

    if (!flightActive) {
        // ON PAD: nose pointing straight up, no spin, no motion
        pitchDeg    = 89.5f;
        rollRateDeg = 0.0f;
        // yawDeg stays as last known heading (or 45° default)

    } else if (t < T_BURNOUT) {
        // BOOST: nearly vertical, gentle pitch-over, spin building
        pitchDeg    = 89.0f - (t / T_BURNOUT) * 2.0f + sinf(t * 5.0f) * 0.4f;
        rollRateDeg = 30.0f;
        yawDeg      = fmodf(yawDeg + 0.3f, 360.0f);

    } else if (t < T_APOGEE) {
        // COAST: fin-stabilised, slow pitch drift, spin decaying
        float ph = (t - T_BURNOUT) / (T_APOGEE - T_BURNOUT);
        pitchDeg    = 87.0f - ph * 8.0f + sinf(t * 1.8f) * 1.2f;
        rollRateDeg = 30.0f * (1.0f - ph) + 4.0f;
        yawDeg      = fmodf(yawDeg + 0.1f, 360.0f);

    } else if (t < T_MAIN) {
        // DROGUE: pitches over, oscillations damping out
        float ph = (t - T_APOGEE) / (T_MAIN - T_APOGEE);
        pitchDeg    = 79.0f * (1.0f - ph) + sinf(t * 3.0f) * (12.0f * (1.0f - ph));
        rollRateDeg = 80.0f * (1.0f - ph) + 5.0f;
        yawDeg      = fmodf(yawDeg + 0.8f, 360.0f);

    } else if (t < T_LAND) {
        // MAIN: hanging from chute, gentle pendulum swing
        pitchDeg    = sinf(t * 0.65f) * 5.0f;
        rollRateDeg = 4.0f;
        yawDeg      = fmodf(yawDeg + 0.15f, 360.0f);

    } else {
        // LANDED
        pitchDeg    = 0.0f;
        rollRateDeg = 0.0f;
    }

    rollAccum += rollRateDeg * dt;
    rollDeg    = fmodf(rollAccum, 360.0f);

    float pitchRate = (!flightActive) ? 0.0f : (pitchDeg - prevPitch) / dt;   // deg/s
    float yawRate   = (!flightActive) ? 0.0f : (t < T_APOGEE) ? 6.0f : 2.0f;

    float rr = rollDeg  * DEG2RAD;
    float pr = pitchDeg * DEG2RAD;
    float yr = yawDeg   * DEG2RAD;

    // ── Specific force along nose axis ────────────────────────────────────
    // (what the accelerometer physically reads, in m/s²)
    float sfNose;
    if (!flightActive) {
        sfNose = G;                              // on pad: +1G static
    } else if (t <= 0.0f || t >= T_LAND) {
        sfNose = G;                              // on ground: +1G
    } else if (t < T_BURNOUT) {
        sfNose = (V_BURNOUT / T_BURNOUT) + G;   // boost: ~62 m/s² ≈ 6.3G
    } else if (t < T_APOGEE) {
        sfNose = 0.5f;                           // coast: near-weightless
    } else if (t < T_MAIN) {
        sfNose = G * 0.85f;                      // drogue drag ≈ 0.85G
    } else {
        sfNose = G;                              // main chute load ≈ 1G
    }

    // Decompose into body frame (nose = primary axis for near-vertical rocket)
    float ax =  sfNose * sinf(pr);
    float ay =  sfNose * sinf(rr) * cosf(pr);
    float az =  sfNose * cosf(rr) * cosf(pr);

    sendAttitude(rr, pr, yr,
                 rollRateDeg * DEG2RAD, pitchRate * DEG2RAD, yawRate * DEG2RAD);
    sendScaledImu(ax, ay, az,
                  rollRateDeg, pitchRate, yawRate,
                  cosf(yr) * 230.0f, sinf(yr) * 230.0f, -420.0f);
}

// Called at 10 Hz
void updateFlight() {
    float alt   = flightAlt(t);
    float vz    = flightVZ(t);
    float speed = fabsf(vz);
    uint16_t thr = (t > 0.0f && t < T_BURNOUT) ? 100 : 0;

    sendVfrHud(speed, alt, vz, (int16_t)yawDeg, thr);
    sendGlobalPosInt(flightLat(t), flightLon(t), alt, vz, yawDeg);
}

// Call at 1 Hz — mirrors telemetryStore.ts
void updateRadio() {
    rssiVal  = clampf(rssiVal  + (float)(random(-3, 4)) * 0.5f, 20.0f, 100.0f);
    remRssi  = clampf(remRssi  + (float)(random(-2, 3)) * 0.5f, 15.0f, 100.0f);
    noiseVal = clampf(noiseVal + (float)(random(-2, 3)) * 0.3f,  2.0f,  40.0f);
    sendRadioStatus((uint8_t)rssiVal, (uint8_t)remRssi, (uint8_t)noiseVal);
}

// ── Command receive ──────────────────────────────────────────────────────────
// Handles incoming COMMAND_LONG (#76) packets:
//   cmd=400, param1>=0.5  (ARM)          → set esArmed=true
//   cmd=400, param1< 0.5  (DISARM)       → set esArmed=false, stop flight
//   cmd=300               (MISSION_START) → start flight if armed
//   cmd=185               (ABORT)         → stop flight, disarm
void checkCommands() {
    if (!tcpClient || !tcpClient.connected()) return;
    if (tcpClient.available() < 41) return;   // minimum COMMAND_LONG frame = 41 bytes
    uint8_t buf[64];
    int n = tcpClient.read(buf, sizeof(buf));
    if (n < 41 || buf[0] != 0xFE || buf[5] != 76) return;  // must be STX + COMMAND_LONG

    // payload starts at buf[6]; cmd at payload offset 30/31, param1 at offset 0
    uint16_t cmd = (uint16_t)buf[36] | ((uint16_t)buf[37] << 8);
    float    param1;
    memcpy(&param1, buf + 6, 4);

    if (cmd == 400) {
        if (param1 >= 0.5f) {
            // ARM
            esArmed = true;
            Serial.println("CMD: ARM — system armed");
        } else {
            // DISARM
            esArmed      = false;
            flightActive = false;
            Serial.println("CMD: DISARM — system disarmed");
        }
    } else if (cmd == 300) {
        // MISSION_START — begin flight only if armed
        if (esArmed) {
            t            = 0.0f;
            rollAccum    = 0.0f;
            yawDeg       = 45.0f;
            pitchDeg     = 89.0f;
            flightActive = true;
            Serial.println("CMD: MISSION_START — flight started");
        } else {
            Serial.println("CMD: MISSION_START ignored — not armed");
        }
    } else if (cmd == 185) {
        // ABORT / FLIGHT_TERMINATION
        flightActive = false;
        esArmed      = false;
        t            = T_LAND + 1.0f;
        Serial.println("CMD: ABORT — flight terminated, system disarmed");
    }
}

// ── Arduino setup / loop ──────────────────────────────────────────────────────
static unsigned long lastImu  = 0;
static unsigned long lastHud  = 0;
static unsigned long lastBeat = 0;

void setup() {
    Serial.begin(115200);

    WiFi.mode(WIFI_AP);
    WiFi.softAP(AP_SSID, AP_PASS[0] ? AP_PASS : nullptr);
    delay(200);  // allow AP to initialise
    IPAddress apIP = WiFi.softAPIP();  // always 192.168.4.1
    tcpServer.begin();
    tcpServer.setNoDelay(true);  // disable Nagle for low-latency MAVLink
    Serial.printf("AP started: SSID=%s  IP=%s\n", AP_SSID, apIP.toString().c_str());
    Serial.printf("Connect your PC to '%s', then click CONNECT in the GCS.\n", AP_SSID);
    Serial.printf("Waiting for TCP connection on %s:%d\n", apIP.toString().c_str(), TCP_PORT);
}

void loop() {
    unsigned long now = millis();

    // Accept a new GCS connection if none is active
    if (!tcpClient || !tcpClient.connected()) {
        WiFiClient newClient = tcpServer.available();
        if (newClient) {
            tcpClient = newClient;
            Serial.println("GCS connected");
        }
    }

    // Always check for incoming commands from GCS
    checkCommands();

    // 20 Hz — ATTITUDE + SCALED_IMU (always when client is connected)
    if (now - lastImu >= 50) {
        lastImu = now;
        if (flightActive) {
            t += 0.05f;
            if (t > T_LAND) flightActive = false;  // auto-stop after landing
        }
        updateImu();  // always stream — shows on-pad readings when not flying
    }

    // 10 Hz — VFR_HUD + GLOBAL_POSITION_INT (only while flight is active)
    if (now - lastHud >= 100) {
        lastHud = now;
        if (flightActive) {
            updateFlight();
        }
    }

    // 1 Hz — HEARTBEAT + RADIO_STATUS (always, so GCS can see the ESP32)
    if (now - lastBeat >= 1000) {
        lastBeat = now;
        sendHeartbeat();
        updateRadio();
    }
}
