/*
 * Rocket GCS — ESP32 MAVLink Fake Sensor Firmware
 * ─────────────────────────────────────────────────────────────────────────────
 * Generates simulated rocket flight data and transmits it as real MAVLink v1
 * messages over Wi-Fi UDP to the Rocket GCS desktop application.
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
 *   1. Fill in WIFI_SSID, WIFI_PASS, and GCS_IP below.
 *   2. On the GCS machine, click CONNECT — it listens on UDP port 14550.
 *   3. Flash the ESP32 and open Serial Monitor at 115200 baud to see status.
 * ─────────────────────────────────────────────────────────────────────────────
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiUdp.h>
#include <math.h>

// ── User configuration ───────────────────────────────────────────────────────
#define WIFI_SSID   "YourWiFiSSID"
#define WIFI_PASS   "YourWiFiPassword"
#define GCS_IP      "192.168.1.100"   // IP of the PC running Rocket GCS
#define GCS_PORT    14550             // Standard MAVLink GCS UDP port
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

static WiFiUDP  udp;
static IPAddress gcsIP;
static uint8_t  seq   = 0;
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

    udp.beginPacket(gcsIP, GCS_PORT);
    udp.write(txBuf, 8 + plen);
    udp.endPacket();
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

void sendGlobalPosInt(float alt_m, float climb_ms, float hdg_deg) {
    uint8_t p[28];
    pu32(p,    millis());
    pi32(p+4,  0);                              // lat (sim: 0)
    pi32(p+8,  0);                              // lon (sim: 0)
    pi32(p+12, (int32_t)(alt_m * 1000.0f));     // alt MSL mm
    pi32(p+16, (int32_t)(alt_m * 1000.0f));     // relative alt mm
    pi16(p+20, 0);                              // vx cm/s
    pi16(p+22, 0);                              // vy cm/s
    pi16(p+24, (int16_t)(-climb_ms * 100.0f));  // vz cm/s (NED: up = negative)
    pu16(p+26, (uint16_t)(hdg_deg * 100.0f));   // heading cdeg
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

// ── Fake sensor state ────────────────────────────────────────────────────────
static float t         = 0.0f;
static float yawDeg    = 0.0f;
static float rollDeg   = 0.0f, prevRoll  = 0.0f;
static float pitchDeg  = 0.0f, prevPitch = 0.0f;
static float rssiVal   = 78.0f;
static float remRssi   = 72.0f;
static float noiseVal  = 12.0f;

static const float G      = 9.80665f;
static const float DEG2RAD = (float)M_PI / 180.0f;

// ── Simulation update functions ───────────────────────────────────────────────

// Call at 20 Hz (dt = 0.05 s) — mirrors imuStore.ts
void updateImu() {
    const float dt = 0.05f;
    prevRoll  = rollDeg;
    prevPitch = pitchDeg;

    rollDeg  = sinf(t * 0.5f) * 45.0f;
    pitchDeg = cosf(t * 0.3f) * 30.0f;
    yawDeg   = fmodf(yawDeg + 0.5f, 360.0f);

    float rollRate  = (rollDeg  - prevRoll)  / dt;   // deg/s
    float pitchRate = (pitchDeg - prevPitch) / dt;
    float yawRate   = 10.0f;

    float rr = rollDeg  * DEG2RAD;
    float pr = pitchDeg * DEG2RAD;
    float yr = yawDeg   * DEG2RAD;

    float ax = -sinf(pr) * G;
    float ay =  sinf(rr) * cosf(pr) * G;
    float az =  cosf(rr) * cosf(pr) * G;

    sendAttitude(rr, pr, yr,
                 rollRate * DEG2RAD, pitchRate * DEG2RAD, yawRate * DEG2RAD);
    sendScaledImu(ax, ay, az,
                  rollRate, pitchRate, yawRate,
                  cosf(yr) * 250.0f, sinf(yr) * 250.0f, -400.0f);
}

// Call at 10 Hz (dt = 0.1 s) — mirrors flightStore.ts
void updateFlight() {
    float phase = fminf(t / 80.0f, 1.0f);
    float alt   = sinf(phase * (float)M_PI) * 12000.0f;
    float speed = fabsf(cosf(phase * (float)M_PI) * 600.0f);
    float climb = cosf(phase * (float)M_PI) * 350.0f;
    uint16_t thr = (phase < 0.5f) ? 100 : 0;

    sendVfrHud(speed, alt, climb, (int16_t)yawDeg, thr);
    sendGlobalPosInt(alt, climb, yawDeg);
}

// Call at 1 Hz — mirrors telemetryStore.ts
void updateRadio() {
    rssiVal  = clampf(rssiVal  + (float)(random(-3, 4)) * 0.5f, 20.0f, 100.0f);
    remRssi  = clampf(remRssi  + (float)(random(-2, 3)) * 0.5f, 15.0f, 100.0f);
    noiseVal = clampf(noiseVal + (float)(random(-2, 3)) * 0.3f,  2.0f,  40.0f);
    sendRadioStatus((uint8_t)rssiVal, (uint8_t)remRssi, (uint8_t)noiseVal);
}

// ── Arduino setup / loop ──────────────────────────────────────────────────────
static unsigned long lastImu  = 0;
static unsigned long lastHud  = 0;
static unsigned long lastBeat = 0;

void setup() {
    Serial.begin(115200);

    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    Serial.print("Connecting to Wi-Fi");
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.printf("\nConnected! Local IP: %s\n", WiFi.localIP().toString().c_str());
    gcsIP.fromString(GCS_IP);
    udp.begin(14555);   // local port (only needed to open the socket)
    Serial.printf("Streaming MAVLink to %s:%d\n", GCS_IP, GCS_PORT);
}

void loop() {
    unsigned long now = millis();

    // 20 Hz — ATTITUDE + SCALED_IMU
    if (now - lastImu >= 50) {
        lastImu = now;
        t += 0.05f;
        updateImu();
    }

    // 10 Hz — VFR_HUD + GLOBAL_POSITION_INT
    if (now - lastHud >= 100) {
        lastHud = now;
        updateFlight();
    }

    // 1 Hz — HEARTBEAT + RADIO_STATUS
    if (now - lastBeat >= 1000) {
        lastBeat = now;
        sendHeartbeat();
        updateRadio();
    }
}
