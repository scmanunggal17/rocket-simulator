# Rocket GCS — User Guide

Rocket GCS is a ground control station desktop application for monitoring and simulating rocket flights. It supports two modes: a built-in **Simulation** mode for testing and training, and a **Controller** mode for reading live data from a serial-connected flight controller.

---

## Application Layout

```
┌──────────────────────────────────────────────────────────┐
│  HEADER — title · phase · launch/abort · serial connect  │
├──────────────────────────────────────────────────────────┤
│  TOP PANEL — live flight telemetry (3 groups)            │
├────────────────────────────────┬─────────────────────────┤
│                                │                         │
│  MAIN WINDOW (tabbed)          │  SIDE PANEL             │
│  · SIMULATION                  │  · Attitude indicator   │
│  · TRAJECTORY                  │  · Compass indicator    │
│  · LOG REPLAY                  │  · Raw IMU sensors      │
│  · MAPS                       │                         │
│                                │                         │
└────────────────────────────────┴─────────────────────────┘
```

The side panel can be resized by dragging the divider between the main window and the side panel.

---

## How a Flight Works (Step by Step)

1. Choose your **Data Source** on the SIMULATION tab: **SIMULATION** or **CONTROLLER**.
2. Fill in the **Initial Values** and **Rocket Specifications**.
3. Press **✓ CONFIRM**. The phase changes to **READY**.
4. Press **▲ LAUNCH** in the header. A countdown begins.
5. When the countdown reaches zero, the rocket launches through the flight phases:
   **BOOST → COAST → APOGEE → DESCENT → LANDED**
6. When the rocket lands, a flight log is automatically saved.
7. Press **↺ RESET** to return to STANDBY and start a new mission.

---

## Header Bar

| Element | Description |
|---|---|
| **Rocket GCS** | Application title |
| **Phase Badge** | Shows the current flight phase (see Flight Phases below) |
| **▲ LAUNCH** | Starts the countdown and launches the rocket. Only available when phase is READY |
| **T–N** | Countdown display (shown during COUNTDOWN phase) |
| **■ ABORT** | Cancels the flight mid-mission. All telemetry freezes |
| **↺ RESET** | Returns everything to STANDBY after a flight completes or is aborted |
| **RATE** | Telemetry throughput — how many data messages per second are being processed |
| **Serial Port** | Dropdown to select the serial/COM port for controller connection |
| **⟳** | Refresh the list of available serial ports |
| **CONNECT / DISCONNECT** | Open or close the serial connection to the flight controller |

---

## Flight Phases

The flight progresses through these phases in order:

| Phase | Color | Description |
|---|---|---|
| **STANDBY** | Gray | Waiting for the user to configure and confirm parameters |
| **READY** | Blue | Configuration confirmed. Ready to launch |
| **COUNTDOWN** | Yellow | Counting down to ignition. Duration is set by the Count Down Time parameter |
| **BOOST** | Orange | Motor is firing. Thrust is pushing the rocket upward. Fuel is being consumed |
| **COAST** | Blue | Motor has burned out (fuel empty). Rocket is still climbing on momentum but decelerating due to gravity |
| **APOGEE** | Purple | The rocket has reached its highest point. Vertical speed is near zero |
| **DESCENT** | Orange | Rocket is falling back down under gravity |
| **LANDED** | Green | Rocket has touched down. Flight log is automatically saved |
| **ABORTED** | Red | Flight was manually aborted by the user |

---

## Top Panel — Live Telemetry

Always visible below the header. Shows real-time values in three groups.

### FLIGHT

| Label | Unit | What It Shows | How It Is Calculated |
|---|---|---|---|
| **DURATION** | mm:ss | Time since the motor ignited | Timer starts at BOOST and counts up every 0.1 seconds |
| **SPEED** | m/s | Total speed of the rocket | √(horizontal_speed² + vertical_speed²) |
| **V-SPEED** | m/s | Vertical speed (up/down) | Rate of altitude change. Positive = going up, negative = coming down |
| **ACCEL** | m/s² | Current acceleration | During BOOST: thrust ÷ dry_mass. After burnout: gravity (≈ 9.81 m/s²) pulling the rocket down |

### ALTITUDE

| Label | Unit | What It Shows | How It Is Calculated |
|---|---|---|---|
| **CURRENT** | m | Height above the launch point (AGL) | Starts at the Altitude Relative value and changes based on vertical speed × time |
| **MAX** | m | Highest altitude reached so far | Tracks the peak of CURRENT altitude throughout the flight |
| **DOWNRANGE** | km | Horizontal distance from the launch pad | Accumulated horizontal speed × time, converted to kilometers |
| **APOGEE ETA** | s | Seconds until the rocket reaches its peak | vertical_speed ÷ gravity (9.81). Shows 0 after apogee is reached |

### PROPULSION

| Label | Unit | What It Shows | How It Is Calculated |
|---|---|---|---|
| **FUEL USED** | kg | How much fuel has been burned | elapsed_time × fuel_burn_rate, capped at Fuel Mass |
| **REMAINING** | kg | Fuel left in the rocket | Fuel Mass − Fuel Used. Changes color: blue (normal), yellow (<30%), red (<15%) |
| **CAPACITY** | % | Fuel gauge bar | (Remaining ÷ Fuel Mass) × 100 |

> Fuel burn rate = Fuel Mass ÷ Burn Time (kg/s). For example: 3 kg fuel ÷ 5 s burn time = 0.6 kg/s.

---

## Main Window — Tabs

### SIMULATION Tab

This is where you set up and configure a flight.

#### Data Source

Toggle between two modes:

| Mode | Description |
|---|---|
| **SIMULATION** | The app generates all flight data using physics calculations. No hardware needed |
| **CONTROLLER** | The app reads altitude, attitude, and GPS data from a serial-connected flight controller. You still need to enter rocket specifications manually |

#### Initial Values (Simulation Mode Only)

These set the starting conditions for the simulated flight.

| Parameter | Unit | Default | Description |
|---|---|---|---|
| **Altitude Absolute** | m ASL | 100 | Starting altitude above sea level. This is the real-world elevation of your launch site |
| **Altitude Relative** | m AGL | 0 | Starting altitude above ground level. Usually 0 (launching from the ground) |
| **Pitch** | degrees | 45 | Launch angle from horizontal. 90° = straight up, 0° = horizontal. This determines how much thrust goes upward vs. forward |
| **Roll** | degrees | 0 | Initial roll rotation. 0° = level. The rocket will oscillate slightly around this value during flight |
| **Yaw** | degrees | 0 | Compass heading of the launch direction (0° = North, 90° = East, 180° = South, 270° = West) |
| **Latitude** | degrees | −7.800000 | GPS latitude of the launch site |
| **Longitude** | degrees | 110.370000 | GPS longitude of the launch site |

#### Rocket Specifications

These define the physical properties of your rocket. Available in both Simulation and Controller modes.

| Parameter | Unit | Default | Description |
|---|---|---|---|
| **Dry Mass** | kg | 10 | Weight of the rocket without fuel. Used to calculate acceleration: acceleration = thrust ÷ dry_mass |
| **Thrust** | N | 1000 | Force produced by the motor in Newtons. Higher thrust = faster acceleration |
| **Burn Time** | s | 5 | How long the motor fires. After this time, the fuel is exhausted and the rocket coasts on momentum |
| **Fuel Mass** | kg | 3 | Total weight of the propellant. Used to track fuel consumption and remaining fuel percentage |
| **Nozzle Type** | — | Conical | Shape of the rocket nozzle. Selecting a preset automatically fills in Thrust Efficiency and Nozzle Mass. Options: **Conical** (93%, 0.5 kg), **Bell / de Laval** (97%, 0.7 kg), **Aerospike** (99%, 1.0 kg), **Custom** (user-defined) |
| **Thrust Efficiency** | 0–1 | 0.93 | Fraction of rated thrust actually delivered by the nozzle. Editable only when Nozzle Type is Custom. Effective thrust = Thrust × Thrust Efficiency |
| **Nozzle Mass** | kg | 0.5 | Weight of the nozzle hardware. Added to Dry Mass when calculating acceleration. Editable only when Nozzle Type is Custom |
| **Count Down Time** | s | 10 | How many seconds to count down before ignition after pressing LAUNCH |

#### How the Simulation Calculates Flight

1. **BOOST phase**: The motor applies a constant thrust, reduced by the nozzle's thrust efficiency. The nozzle mass is added to dry mass when computing acceleration. This acceleration is split into vertical and horizontal components based on the pitch angle.
   - Effective thrust = Thrust × Thrust Efficiency
   - Total dry mass = Dry Mass + Nozzle Mass
   - Vertical acceleration = sin(pitch) × (effective_thrust ÷ total_dry_mass) − gravity
   - Horizontal acceleration = cos(pitch) × (effective_thrust ÷ total_dry_mass)

2. **COAST phase**: Motor has stopped. Only gravity acts on the rocket (pulling it down at 9.81 m/s²). Horizontal speed decreases slightly due to air drag.

3. **APOGEE**: The moment vertical speed crosses zero — the rocket stops going up and starts falling.

4. **DESCENT**: Gravity pulls the rocket back down. Vertical speed becomes increasingly negative.

5. **LANDED**: Altitude returns to the starting relative altitude. All speeds go to zero.

> **Pitch matters a lot.** A 90° pitch sends all thrust straight up (maximum altitude, no downrange). A 45° pitch splits thrust equally between altitude and distance. Lower angles give more downrange but less height.

#### Confirm & Launch

| Button | When Available | What It Does |
|---|---|---|
| **✓ CONFIRM** | STANDBY phase | Locks in your parameters and moves to READY phase |
| **EDIT** | READY phase | Unlocks parameters so you can change them |
| **▲ LAUNCH** | READY phase (in header) | Starts the countdown, then launches |

---

### TRAJECTORY Tab

Shows two real-time visualizations during flight:

#### Attitude View (left)

A 3D rocket silhouette that rotates to show the rocket's current orientation.

| Display | Description |
|---|---|
| **Rocket body** | Points in the direction the rocket is flying. Tilts based on pitch |
| **Roll ring** | Small arc around the body showing roll rotation |
| **Engine plume** | Orange flame shown during BOOST phase only |
| **P / R / Y readout** | Current pitch, roll, and yaw angles in degrees |

#### Trajectory Chart (right)

An altitude-over-time graph that draws in real time as the rocket flies.

| Element | Description |
|---|---|
| **Y axis** | Altitude in meters |
| **X axis** | Mission time in seconds |
| **Line color** | Changes by flight phase — orange (ascending), purple (apogee), blue (descending), green (ground) |
| **White dot** | Current position on the trajectory |
| **Live readout** | Shows current altitude, vertical speed, and max altitude at the top |

---

### LOG REPLAY Tab

Open a previously saved flight log and view the trajectory data without running a new simulation.

#### How to Use

1. Click **⏏ OPEN LOG FILE**.
2. A file picker will appear. Navigate to `~/Documents/rocket-simulator/logs/` and select a `.json` file.
3. The trajectory chart and all flight data will be displayed.

#### What Is Shown

| Section | Contents |
|---|---|
| **Trajectory Chart** | The same altitude-over-time graph as the TRAJECTORY tab, drawn from saved data. Includes phase marker lines showing when each phase transition occurred |
| **Summary** | Max altitude, max vertical speed, flight duration, downrange distance |
| **Phases** | Each phase transition with its timestamp (e.g., BOOST at T+0.0s, COAST at T+5.0s) |
| **Configuration** | All the parameters that were used for that flight (altitude, pitch, mass, thrust, etc.) |

> Log files are JSON format and saved to: `~/Documents/rocket-simulator/logs/flight_YYYYMMDD_HHMMSS.json`

---

### MAPS Tab

Displays the rocket's GPS position on a map. The position updates in real time during flight using the launch site coordinates and the rocket's downrange distance projected along the yaw heading.

---

## Side Panel — IMU & Attitude

The right panel shows inertial measurement data. Always visible regardless of which tab is active.

### Attitude Indicator

An artificial horizon instrument showing:
- **Pitch**: How far the nose is tilted up or down from horizontal
- **Roll**: How far the rocket is tilted sideways

### Compass Indicator

A heading display showing:
- **Yaw**: Current compass heading (0–360°)
- **Yaw rate**: How fast the heading is changing

### Raw Sensors

Three sensor cards showing X / Y / Z axis values with bar graphs:

| Sensor | Unit | What It Measures |
|---|---|---|
| **Accelerometer** | m/s² | Linear acceleration on each axis. During BOOST this shows the thrust force; in free flight it shows gravity |
| **Gyroscope** | deg/s | How fast the rocket is rotating around each axis |
| **Magnetometer** | mGauss | Earth's magnetic field strength, used to determine compass heading |

Bar colors indicate intensity: green (normal), yellow (warning), red (critical).

---

## Flight Log (Auto-Save)

Every completed flight is automatically saved when the rocket lands (LANDED phase). No action is needed from the user.

### What Is Saved

| Section | Data |
|---|---|
| **Meta** | Flight ID (based on date/time), date, data source (simulation or controller) |
| **Configuration** | All initial values and rocket specifications used for the flight |
| **Events** | Every phase transition with its timestamp |
| **Summary** | Max altitude, max vertical speed, total flight duration, downrange distance |
| **Telemetry** | Full time-series of altitude and vertical speed, sampled ~10 times per second |

### File Location

```
~/Documents/rocket-simulator/logs/flight_YYYYMMDD_HHMMSS.json
```

Example: `flight_20260405_143022.json`

These files can be opened later using the **LOG REPLAY** tab.

---

## Connecting a Serial Controller

1. Plug your flight controller into the computer via USB.
2. Click the **⟳** button next to the port dropdown to refresh available ports.
3. Select the correct port from the dropdown (e.g., `/dev/tty.usbserial-XXX` on Mac).
4. Click **CONNECT**. The status dot turns green when connected.
5. Switch the data source to **CONTROLLER** on the SIMULATION tab.
6. Enter your **Rocket Specifications** and press **✓ CONFIRM**.
7. Press **▲ LAUNCH** when ready.

The controller must send CSV data over serial in this format:
```
altitudeAbs, altitudeRel, pitch, roll, yaw, latitude, longitude
```

Default baud rate: **115200**.
