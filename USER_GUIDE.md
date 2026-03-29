# Rocket GCS — User Guide

Rocket GCS is a ground control station (GCS) desktop application for monitoring and simulating rocket flights. It is built to interface with MAVLink-compatible avionics hardware, with a built-in simulation mode for testing and training.

---

## Layout Overview

```
┌─────────────────────────────────────────────────────────┐
│  HEADER  — title · phase · telemetry stats · connect    │
├─────────────────────────────────────────────────────────┤
│  TOP PANEL  — live flight telemetry (7 values)          │
├──────────────────────────────┬──────────────────────────┤
│                              │                          │
│  MAIN WINDOW (tabbed)        │  SIDE PANEL              │
│  · SIMULATION tab            │  · Attitude indicators   │
│  · MAPS tab                  │  · Raw IMU sensors       │
│                              │                          │
└──────────────────────────────┴──────────────────────────┘
```

The **side panel** can be resized by dragging the divider between the main window and side panel.

---

## Header Bar

| Element | Description |
|---|---|
| **Rocket GCS** | Application title |
| **Phase** | Current flight phase badge (e.g. BOOST, COAST, DESCENT) |
| **RSSI** | Local radio signal strength (0–100 %). Color: 🟢 ≥55 · 🟡 30–54 · 🔴 <30 |
| **RC** | Remote (rocket-side) radio signal strength (0–100 %) |
| **NOISE** | RF noise floor level. Lower is better |
| **RATE** | Telemetry message throughput in messages per second |
| **CONNECT / DISCONNECT** | Connect or disconnect from the MAVLink serial link. Button turns green when connected |

> Data source: MAVLink `RADIO_STATUS` (#109) and `HEARTBEAT` (#0).

---

## Top Panel — Flight Telemetry

Always visible below the header. Displays live values in three groups.

### FLIGHT

| Label | Unit | Description |
|---|---|---|
| **DURATION** | mm:ss | Elapsed time since launch |
| **SPEED** | m/s | Total airspeed (magnitude) |
| **V-SPEED** | m/s | Vertical speed. Green = ascending (+), orange = descending (−) |
| **ACCEL** | m/s² | Current vertical acceleration |

### ALTITUDE

| Label | Unit | Description |
|---|---|---|
| **CURRENT** | m | Current altitude above ground level (AGL) |
| **MAX** | m | Peak altitude reached so far (shown in purple) |
| **DOWNRANGE** | km | Horizontal distance travelled from the launch pad |
| **APOGEE ETA** | s | Estimated seconds until the rocket reaches its highest point. Counts down to 0 at apogee |

### PROPULSION

| Label | Unit | Description |
|---|---|---|
| **FUEL USED** | kg | Mass of propellant consumed |
| **REMAINING** | kg | Remaining propellant mass. Color: 🔵 normal · 🟡 <30 % · 🔴 <15 % |
| **CAPACITY** | % | Fuel level bar showing remaining percentage |

---

## Main Window

### SIMULATION Tab

Use this tab to configure and launch a simulated flight.

#### Launch Configuration (editable inputs)

All fields are locked while a simulation is running and can only be changed before starting.

| Field | Unit | Range | Default | Description |
|---|---|---|---|---|
| **Fuel Capacity** | kg | 10 – 2000 | 450 | Total propellant mass loaded on the rocket |
| **Launch Angle** | deg | 45 – 90 | 90 | Rail/launch angle from horizontal. 90° = vertical |
| **Thrust** | N | 100 – 50 000 | 5 000 | Average motor thrust during the burn phase |
| **Burn Time** | s | 1 – 60 | 8 | Duration of the motor burn |

#### Rocket Specifications (static display)

Read-only reference data for the physical rocket. These are fixed for the current model (DART-1):

| Field | Value |
|---|---|
| Model | DART-1 |
| Length | 2.40 m |
| Diameter | 152 mm |
| Dry Mass | 8.5 kg |
| Fin Span | 380 mm |
| Motor | I-class hybrid |
| Parachute | 12 in elliptical |
| Launch Site | PAD-01 |

#### Controls

| Button | Action |
|---|---|
| **▶ START SIMULATION** | Resets all flight data and begins the simulation using the configured parameters |
| **■ STOP** | Halts the simulation. All telemetry values freeze at their last state |

A pulsing green dot and **SIMULATION RUNNING** indicator is shown while the simulation is active.

### MAPS Tab

_Reserved for map / trajectory visualization. Currently blank — to be implemented when GPS telemetry integration is available._

---

## Side Panel — IMU & Attitude

The right-side panel shows inertial measurement data. It can be resized by dragging the divider handle.

### ATTITUDE

| Instrument | Description |
|---|---|
| **Attitude Indicator** | Artificial horizon showing roll and pitch angles in degrees |
| **Compass Indicator** | Heading display showing yaw (0–360°) and yaw rate |

> Data source: MAVLink `ATTITUDE` (#30) — roll, pitch, yaw, roll rate, pitch rate, yaw rate.

### RAW SENSORS · SCALED_IMU

Three sensor cards, each showing X / Y / Z axes with a centered bar graph and color-coded values:

| Sensor | Unit | Warning | Critical | Description |
|---|---|---|---|---|
| **ACCELEROMETER** | m/s² | ±10 | ±15 | Linear acceleration on each axis |
| **GYROSCOPE** | deg/s | ±45 | ±90 | Angular rate on each axis |
| **MAGNETOMETER** | mGauss | — | — | Magnetic field strength on each axis |

Bar color: 🟢 normal · 🟡 at warning threshold · 🔴 at critical threshold.

> Data source: MAVLink `SCALED_IMU` (#26).

---

## Connecting to Real Hardware

1. Click **CONNECT** in the header.
2. The application will open the MAVLink serial link (configuration to be added in settings).
3. On successful connection the button turns green and shows **DISCONNECT**.
4. All simulated data in the stores will be replaced by live MAVLink messages automatically — no other changes needed.

> **Note:** When connected to real hardware, do **not** start a simulation — the simulation and live data both write to the same stores.
