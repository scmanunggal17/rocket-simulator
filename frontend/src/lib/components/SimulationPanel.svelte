<script lang="ts">
    import {
        simulating,
        configured,
        flightPhase,
        simConfig,
        configureSimulation,
        configureControllerSpecs,
        unconfigureSimulation,
        countdownDuration,
    } from "../stores/simulationControl";
    import type { NozzleType } from "../stores/flightStore";
    import { imuSource } from "../stores/imuSource";
    import { connected, lastSerialData } from "../stores/telemetryStore";
    import { get } from "svelte/store";

    const controllerNozzleMap: Record<number, NozzleType> = {
        1: "conical",
        2: "bell",
        3: "aerospike",
    };

    // Nozzle presets
    const nozzlePresets: Record<string, { efficiency: number; mass: number }> =
        {
            conical: { efficiency: 0.93, mass: 0.5 },
            bell: { efficiency: 0.97, mass: 0.7 },
            aerospike: { efficiency: 0.99, mass: 1.0 },
            custom: { efficiency: 0.95, mass: 0.5 },
        };

    // Configuration inputs — seeded from the store so tab-switching doesn't reset them
    const _cfg = get(simConfig);
    let altitudeAbs = _cfg.altitudeAbs;
    let altitudeRel = _cfg.altitudeRel;
    let pitchVal = _cfg.pitch;
    let rollVal = _cfg.roll;
    let yawVal = _cfg.yaw;
    let lat = _cfg.lat;
    let lon = _cfg.lon;
    let dryMass = _cfg.dryMass;
    let thrust = _cfg.thrust;
    let burnTime = _cfg.burnTime;
    let fuelMass = _cfg.fuelMass;
    let nozzleType: NozzleType = _cfg.nozzleType;
    let thrustEfficiency = _cfg.thrustEfficiency;
    let nozzleMass = _cfg.nozzleMass;

    $: locked = $flightPhase !== "STANDBY";
    $: isSerial = $imuSource === "real";
    $: isCustomNozzle = nozzleType === "custom";

    // In controller mode, nozzle type may be dictated by the serial data (1-3).
    // 0 means the controller does not specify it, so the user can edit.
    $: controllerNozzleCode = $lastSerialData?.nozzleType ?? 0;
    $: nozzleLockedByController =
        isSerial && controllerNozzleCode >= 1 && controllerNozzleCode <= 3;
    $: {
        if (nozzleLockedByController) {
            const mapped = controllerNozzleMap[controllerNozzleCode];
            if (mapped && nozzleType !== mapped) {
                nozzleType = mapped;
                onNozzleChange();
            }
        }
    }

    function onNozzleChange() {
        const preset = nozzlePresets[nozzleType];
        if (nozzleType !== "custom") {
            thrustEfficiency = preset.efficiency;
            nozzleMass = preset.mass;
        }
    }

    function handleConfirm() {
        configureSimulation({
            altitudeAbs,
            altitudeRel,
            pitch: pitchVal,
            roll: rollVal,
            yaw: yawVal,
            lat,
            lon,
            dryMass,
            thrust,
            burnTime,
            fuelMass,
            nozzleType,
            thrustEfficiency,
            nozzleMass,
        });
    }

    function handleControllerConfirm() {
        configureControllerSpecs({
            dryMass,
            thrust,
            burnTime,
            fuelMass,
            nozzleType,
            thrustEfficiency,
            nozzleMass,
        });
    }
</script>

<div class="sim-panel">
    <!-- Data source row -->
    <div class="control-row">
        <div class="control-group">
            <span class="control-label">DATA SOURCE</span>
            <div class="toggle-group">
                <button
                    class="toggle-btn"
                    class:active={$imuSource === "sim"}
                    on:click={() => imuSource.set("sim")}>SIMULATION</button
                >
                <button
                    class="toggle-btn"
                    class:active={$imuSource === "real"}
                    on:click={() => imuSource.set("real")}>CONTROLLER</button
                >
            </div>
        </div>
        {#if isSerial}
            <div class="source-hint">
                <span class="hint-dot" class:hint-connected={$connected}></span>
                {#if $connected}
                    Reading data from serial controller
                {:else}
                    Connect serial port to receive data
                {/if}
            </div>
        {/if}
    </div>

    {#if !isSerial}
        <!-- SIM mode: user inputs initial values -->
        <div class="columns">
            <div class="col">
                <div class="section-label">INITIAL VALUES</div>
                <div class="field-group">
                    <label class="field">
                        <span class="field-label">Altitude Absolute</span>
                        <div class="input-row">
                            <input
                                type="number"
                                class="field-input"
                                bind:value={altitudeAbs}
                                step="0.01"
                                disabled={locked}
                            />
                            <span class="field-unit">m ASL</span>
                        </div>
                    </label>
                    <label class="field">
                        <span class="field-label">Altitude Relative</span>
                        <div class="input-row">
                            <input
                                type="number"
                                class="field-input"
                                bind:value={altitudeRel}
                                step="0.01"
                                disabled={locked}
                            />
                            <span class="field-unit">m AGL</span>
                        </div>
                    </label>
                    <label class="field">
                        <span class="field-label">Pitch</span>
                        <div class="input-row">
                            <input
                                type="number"
                                class="field-input"
                                bind:value={pitchVal}
                                step="0.01"
                                disabled={locked}
                            />
                            <span class="field-unit">deg</span>
                        </div>
                    </label>
                    <label class="field">
                        <span class="field-label">Roll</span>
                        <div class="input-row">
                            <input
                                type="number"
                                class="field-input"
                                bind:value={rollVal}
                                step="0.01"
                                disabled={locked}
                            />
                            <span class="field-unit">deg</span>
                        </div>
                    </label>
                    <label class="field">
                        <span class="field-label">Yaw</span>
                        <div class="input-row">
                            <input
                                type="number"
                                class="field-input"
                                bind:value={yawVal}
                                step="0.01"
                                min={0}
                                max={360}
                                disabled={locked}
                            />
                            <span class="field-unit">deg</span>
                        </div>
                    </label>
                    <label class="field">
                        <span class="field-label">Latitude</span>
                        <div class="input-row">
                            <input
                                type="number"
                                class="field-input wide"
                                bind:value={lat}
                                step="0.000001"
                                disabled={locked}
                            />
                            <span class="field-unit">deg</span>
                        </div>
                    </label>
                    <label class="field">
                        <span class="field-label">Longitude</span>
                        <div class="input-row">
                            <input
                                type="number"
                                class="field-input wide"
                                bind:value={lon}
                                step="0.000001"
                                disabled={locked}
                            />
                            <span class="field-unit">deg</span>
                        </div>
                    </label>
                </div>
            </div>

            <div class="col-divider"></div>

            <div class="col">
                <div class="section-label">ROCKET SPECIFICATIONS</div>
                <div class="field-group">
                    <label class="field">
                        <span class="field-label">Dry Mass</span>
                        <div class="input-row">
                            <input
                                type="number"
                                class="field-input"
                                bind:value={dryMass}
                                step="0.1"
                                min={0.1}
                                disabled={locked}
                            />
                            <span class="field-unit">kg</span>
                        </div>
                    </label>
                    <label class="field">
                        <span class="field-label">Thrust</span>
                        <div class="input-row">
                            <input
                                type="number"
                                class="field-input"
                                bind:value={thrust}
                                step="10"
                                min={1}
                                disabled={locked}
                            />
                            <span class="field-unit">N</span>
                        </div>
                    </label>
                    <label class="field">
                        <span class="field-label">Burn Time</span>
                        <div class="input-row">
                            <input
                                type="number"
                                class="field-input"
                                bind:value={burnTime}
                                step="0.5"
                                min={0.5}
                                max={60}
                                disabled={locked}
                            />
                            <span class="field-unit">s</span>
                        </div>
                    </label>
                    <label class="field">
                        <span class="field-label">Fuel Mass</span>
                        <div class="input-row">
                            <input
                                type="number"
                                class="field-input"
                                bind:value={fuelMass}
                                step="0.1"
                                min={0.1}
                                disabled={locked}
                            />
                            <span class="field-unit">kg</span>
                        </div>
                    </label>
                    <label class="field">
                        <span class="field-label">Nozzle Type</span>
                        <div class="input-row">
                            <select
                                class="field-input field-select"
                                bind:value={nozzleType}
                                on:change={onNozzleChange}
                                disabled={locked}
                            >
                                <option value="conical">Conical</option>
                                <option value="bell">Bell (de Laval)</option>
                                <option value="aerospike">Aerospike</option>
                                <option value="custom">Custom</option>
                            </select>
                        </div>
                    </label>
                    <label class="field">
                        <span class="field-label">Thrust Efficiency</span>
                        <div class="input-row">
                            <input
                                type="number"
                                class="field-input"
                                bind:value={thrustEfficiency}
                                step="0.01"
                                min={0.01}
                                max={1}
                                disabled={locked || !isCustomNozzle}
                            />
                            <span class="field-unit"
                                >{(thrustEfficiency * 100).toFixed(0)}%</span
                            >
                        </div>
                    </label>
                    <label class="field">
                        <span class="field-label">Nozzle Mass</span>
                        <div class="input-row">
                            <input
                                type="number"
                                class="field-input"
                                bind:value={nozzleMass}
                                step="0.1"
                                min={0}
                                disabled={locked || !isCustomNozzle}
                            />
                            <span class="field-unit">kg</span>
                        </div>
                    </label>
                    <label class="field">
                        <span class="field-label">Count Down Time</span>
                        <div class="input-row">
                            <input
                                type="number"
                                class="field-input"
                                bind:value={$countdownDuration}
                                step="1"
                                min={1}
                                max={60}
                                disabled={locked}
                            />
                            <span class="field-unit">s</span>
                        </div>
                    </label>
                </div>
            </div>
        </div>

        <!-- Action row -->
        <div class="action-row">
            {#if $flightPhase === "STANDBY"}
                <button class="btn-confirm" on:click={handleConfirm}>
                    ✓ CONFIRM
                </button>
                <span class="action-hint"
                    >Confirm data, then launch from the top menu</span
                >
            {:else if $flightPhase === "READY"}
                <span class="confirmed-badge">✓ DATA CONFIRMED</span>
                <button class="btn-edit" on:click={unconfigureSimulation}
                    >EDIT</button
                >
            {:else}
                <span class="confirmed-badge">✓ DATA CONFIRMED</span>
            {/if}
        </div>
    {:else}
        <!-- CONTROLLER mode: show specs + live status -->
        <div class="columns">
            <div class="col">
                <div class="section-label">CONTROLLER DATA</div>
                <div class="controller-info">
                    <p>
                        All telemetry data is read from the serial controller:
                    </p>
                    <ul>
                        <li>Altitude (absolute & relative)</li>
                        <li>Attitude (pitch, roll, yaw)</li>
                        <li>GPS position (latitude, longitude)</li>
                    </ul>
                    <p class="auto-note">
                        The app automatically derives: vertical speed, max
                        altitude, flight duration, and downrange distance.
                    </p>
                </div>
            </div>

            <div class="col-divider"></div>

            <div class="col">
                <div class="section-label">ROCKET SPECIFICATIONS</div>
                <div class="field-group">
                    <label class="field">
                        <span class="field-label">Dry Mass</span>
                        <div class="input-row">
                            <input
                                type="number"
                                class="field-input"
                                bind:value={dryMass}
                                step="0.1"
                                min={0.1}
                                disabled={locked}
                            />
                            <span class="field-unit">kg</span>
                        </div>
                    </label>
                    <label class="field">
                        <span class="field-label">Thrust</span>
                        <div class="input-row">
                            <input
                                type="number"
                                class="field-input"
                                bind:value={thrust}
                                step="10"
                                min={1}
                                disabled={locked}
                            />
                            <span class="field-unit">N</span>
                        </div>
                    </label>
                    <label class="field">
                        <span class="field-label">Burn Time</span>
                        <div class="input-row">
                            <input
                                type="number"
                                class="field-input"
                                bind:value={burnTime}
                                step="0.5"
                                min={0.5}
                                max={60}
                                disabled={locked}
                            />
                            <span class="field-unit">s</span>
                        </div>
                    </label>
                    <label class="field">
                        <span class="field-label">Fuel Mass</span>
                        <div class="input-row">
                            <input
                                type="number"
                                class="field-input"
                                bind:value={fuelMass}
                                step="0.1"
                                min={0.1}
                                disabled={locked}
                            />
                            <span class="field-unit">kg</span>
                        </div>
                    </label>
                    <label class="field">
                        <span class="field-label">Nozzle Type</span>
                        <div class="input-row">
                            <select
                                class="field-input field-select"
                                bind:value={nozzleType}
                                on:change={onNozzleChange}
                                disabled={locked || nozzleLockedByController}
                            >
                                <option value="conical">Conical</option>
                                <option value="bell">Bell (de Laval)</option>
                                <option value="aerospike">Aerospike</option>
                                <option value="custom">Custom</option>
                            </select>
                            {#if nozzleLockedByController}
                                <span class="controller-badge">CTL</span>
                            {/if}
                        </div>
                    </label>
                    <label class="field">
                        <span class="field-label">Thrust Efficiency</span>
                        <div class="input-row">
                            <input
                                type="number"
                                class="field-input"
                                bind:value={thrustEfficiency}
                                step="0.01"
                                min={0.01}
                                max={1}
                                disabled={locked || !isCustomNozzle}
                            />
                            <span class="field-unit"
                                >{(thrustEfficiency * 100).toFixed(0)}%</span
                            >
                        </div>
                    </label>
                    <label class="field">
                        <span class="field-label">Nozzle Mass</span>
                        <div class="input-row">
                            <input
                                type="number"
                                class="field-input"
                                bind:value={nozzleMass}
                                step="0.1"
                                min={0}
                                disabled={locked || !isCustomNozzle}
                            />
                            <span class="field-unit">kg</span>
                        </div>
                    </label>
                    <label class="field">
                        <span class="field-label">Count Down Time</span>
                        <div class="input-row">
                            <input
                                type="number"
                                class="field-input"
                                bind:value={$countdownDuration}
                                step="1"
                                min={1}
                                max={60}
                                disabled={locked}
                            />
                            <span class="field-unit">s</span>
                        </div>
                    </label>
                </div>
            </div>
        </div>

        <!-- Controller action row -->
        <div class="action-row">
            {#if $flightPhase === "STANDBY"}
                <button class="btn-confirm" on:click={handleControllerConfirm}>
                    ✓ CONFIRM
                </button>
                <span class="action-hint"
                    >Confirm rocket specs, then launch from the top menu</span
                >
            {:else if $flightPhase === "READY"}
                <span class="confirmed-badge">✓ SPECS CONFIRMED</span>
                <button class="btn-edit" on:click={unconfigureSimulation}
                    >EDIT</button
                >
            {:else}
                <span class="confirmed-badge">✓ SPECS CONFIRMED</span>
            {/if}
        </div>
    {/if}
</div>

<style>
    .sim-panel {
        height: 100%;
        padding: 16px;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 20px;
        font-family: "Courier New", Courier, monospace;
        color: #38bdf8;
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: #334155 transparent;
    }

    .columns {
        display: flex;
        gap: 0;
    }

    .col {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 12px;
        min-width: 0;
    }

    .col-divider {
        width: 1px;
        background: #1e293b;
        margin: 0 24px;
        flex-shrink: 0;
    }

    .section-label {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 2px;
        color: #475569;
        text-transform: uppercase;
        border-bottom: 1px solid #1e293b;
        padding-bottom: 6px;
    }

    .field-group {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .field {
        display: flex;
        flex-direction: column;
        gap: 4px;
        cursor: default;
    }

    .field-label {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 1px;
        color: #94a3b8;
        text-transform: uppercase;
    }

    .input-row {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .field-input {
        flex: 1;
        background: #0f172a;
        border: 1px solid #334155;
        border-radius: 4px;
        color: #38bdf8;
        font-family: "Courier New", Courier, monospace;
        font-size: 1rem;
        font-weight: 700;
        padding: 6px 10px;
        outline: none;
        transition: border-color 0.2s;
        max-width: 120px;
    }

    .field-input:focus {
        border-color: #38bdf8;
        box-shadow: 0 0 6px rgba(56, 189, 248, 0.3);
    }

    .field-select {
        max-width: 160px;
        cursor: pointer;
        appearance: none;
        -webkit-appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2394a3b8'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 10px center;
        padding-right: 28px;
    }

    .field-select:disabled {
        cursor: not-allowed;
    }

    .field-input:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    .field-unit {
        font-size: 8px;
        letter-spacing: 1px;
        color: #475569;
        text-transform: uppercase;
    }

    /* IMU source + command row */
    .control-row {
        display: flex;
        gap: 24px;
        padding-top: 8px;
        padding-bottom: 8px;
        border-top: 1px solid #1e293b;
        flex-wrap: wrap;
    }

    .control-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .control-label {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 2px;
        color: #475569;
        text-transform: uppercase;
    }

    .toggle-group {
        display: flex;
        border: 1px solid #334155;
        border-radius: 4px;
        overflow: hidden;
    }

    .toggle-btn {
        padding: 6px 14px;
        border: none;
        background: transparent;
        color: #475569;
        font-family: "Courier New", Courier, monospace;
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .toggle-btn + .toggle-btn {
        border-left: 1px solid #334155;
    }

    .toggle-btn.active {
        background: rgba(56, 189, 248, 0.15);
        color: #38bdf8;
    }

    .toggle-btn:hover:not(.active) {
        color: #94a3b8;
        background: rgba(255, 255, 255, 0.04);
    }

    /* Action row */
    .action-row {
        display: flex;
        align-items: center;
        gap: 16px;
        padding-top: 8px;
        border-top: 1px solid #1e293b;
    }

    .btn-confirm {
        padding: 10px 28px;
        border-radius: 5px;
        border: 1px solid #38bdf8;
        background: rgba(56, 189, 248, 0.08);
        color: #38bdf8;
        font-family: "Courier New", Courier, monospace;
        font-size: 0.9rem;
        font-weight: 800;
        letter-spacing: 0.12em;
        cursor: pointer;
        transition: all 0.2s ease;
        text-transform: uppercase;
    }

    .btn-confirm:hover {
        background: rgba(56, 189, 248, 0.18);
        box-shadow: 0 0 12px rgba(56, 189, 248, 0.4);
    }

    .btn-edit {
        padding: 6px 16px;
        border-radius: 5px;
        border: 1px solid #475569;
        background: transparent;
        color: #94a3b8;
        font-family: "Courier New", Courier, monospace;
        font-size: 0.8rem;
        font-weight: 800;
        letter-spacing: 0.1em;
        cursor: pointer;
        transition: all 0.2s ease;
        text-transform: uppercase;
    }

    .btn-edit:hover {
        border-color: #94a3b8;
        color: #e2e8f0;
    }

    .action-hint {
        font-size: 10px;
        color: #475569;
        letter-spacing: 1px;
    }

    .confirmed-badge {
        font-size: 0.8rem;
        font-weight: 800;
        letter-spacing: 0.1em;
        color: #4ade80;
    }

    .field-input.wide {
        max-width: 160px;
    }

    /* Source hint (controller mode) */
    .source-hint {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 11px;
        letter-spacing: 0.5px;
        color: #64748b;
    }

    .hint-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #475569;
        flex-shrink: 0;
    }

    .hint-dot.hint-connected {
        background: #4ade80;
        box-shadow: 0 0 6px rgba(74, 222, 128, 0.5);
    }

    .controller-badge {
        font-size: 9px;
        font-weight: 800;
        letter-spacing: 1px;
        color: #38bdf8;
        background: rgba(56, 189, 248, 0.12);
        border: 1px solid rgba(56, 189, 248, 0.3);
        border-radius: 3px;
        padding: 2px 5px;
        flex-shrink: 0;
    }

    /* Controller info panel */
    .controller-info {
        font-size: 12px;
        color: #94a3b8;
        line-height: 1.6;
    }

    .controller-info ul {
        margin: 8px 0;
        padding-left: 20px;
    }

    .controller-info li {
        margin: 4px 0;
    }

    .controller-info .auto-note {
        margin-top: 12px;
        padding: 8px 12px;
        background: rgba(56, 189, 248, 0.06);
        border-left: 2px solid #38bdf8;
        border-radius: 2px;
        font-size: 11px;
        color: #64748b;
    }
</style>
