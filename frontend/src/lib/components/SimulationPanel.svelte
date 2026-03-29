<script lang="ts">
    import {
        simulating,
        configured,
        armed,
        flightPhase,
        simConfig,
        configureSimulation,
        unconfigureSimulation,
        armRocket,
        disarmRocket,
    } from "../stores/simulationControl";
    import { imuSource } from "../stores/imuSource";
    import { get } from "svelte/store";

    // Configuration inputs — seeded from the store so tab-switching doesn't reset them
    const _cfg = get(simConfig);
    let fuelCapacity = _cfg.fuelCapacity;
    let launchAngle = _cfg.launchAngle;
    let thrust = _cfg.thrust;
    let burnTime = _cfg.burnTime;

    // Static rocket specifications
    const specs = [
        { label: "Model", value: "DART-1" },
        { label: "Length", value: "2.40 m" },
        { label: "Diameter", value: "152 mm" },
        { label: "Dry Mass", value: "8.5 kg" },
        { label: "Fin Span", value: "380 mm" },
        { label: "Motor", value: "I-class hybrid" },
        { label: "Parachute", value: "12 in elliptical" },
        { label: "Launch Site", value: "PAD-01" },
    ];

    $: locked = $configured || $simulating;

    function handleConfirm() {
        configureSimulation({ fuelCapacity, launchAngle, thrust, burnTime });
    }
</script>

<div class="sim-panel">
    <div class="columns">
        <!-- Left: Configuration -->
        <div class="col">
            <div class="section-label">LAUNCH CONFIGURATION</div>
            <div class="field-group">
                <label class="field">
                    <span class="field-label">Fuel Capacity</span>
                    <div class="input-row">
                        <input
                            type="number"
                            class="field-input"
                            bind:value={fuelCapacity}
                            min={10}
                            max={2000}
                            disabled={locked}
                        />
                        <span class="field-unit">kg</span>
                    </div>
                </label>
                <label class="field">
                    <span class="field-label">Launch Angle</span>
                    <div class="input-row">
                        <input
                            type="number"
                            class="field-input"
                            bind:value={launchAngle}
                            min={45}
                            max={90}
                            disabled={locked}
                        />
                        <span class="field-unit">deg</span>
                    </div>
                </label>
                <label class="field">
                    <span class="field-label">Thrust</span>
                    <div class="input-row">
                        <input
                            type="number"
                            class="field-input"
                            bind:value={thrust}
                            min={100}
                            max={50000}
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
                            min={1}
                            max={60}
                            disabled={locked}
                        />
                        <span class="field-unit">s</span>
                    </div>
                </label>
            </div>
        </div>

        <div class="col-divider"></div>

        <!-- Right: Static specs -->
        <div class="col">
            <div class="section-label">ROCKET SPECIFICATIONS</div>
            <div class="specs-grid">
                {#each specs as spec}
                    <span class="spec-label">{spec.label}</span>
                    <span class="spec-value">{spec.value}</span>
                {/each}
            </div>
        </div>
    </div>

    <!-- IMU source row -->
    <div class="control-row">
        <div class="control-group">
            <span class="control-label">IMU SOURCE</span>
            <div class="toggle-group">
                <button
                    class="toggle-btn"
                    class:active={$imuSource === "sim"}
                    on:click={() => imuSource.set("sim")}>SIM</button
                >
                <button
                    class="toggle-btn"
                    class:active={$imuSource === "real"}
                    on:click={() => imuSource.set("real")}>REAL ESP32</button
                >
            </div>
        </div>
    </div>

    <!-- ARM / status row -->
    <div class="action-row">
        {#if !$configured && !$simulating}
            <button class="btn-confirm" on:click={handleConfirm}>
                ✓ CONFIRM
            </button>
            <span class="action-hint">Set parameters before arming</span>
        {:else if $configured && !$armed && !$simulating}
            <button class="btn-arm-safety" on:click={armRocket}>
                🔒 ARM ROCKET
            </button>
            <button class="btn-edit" on:click={unconfigureSimulation}
                >EDIT</button
            >
        {:else if $configured && $armed && !$simulating}
            <div class="armed-indicator">
                <span class="ready-dot"></span>
                ARMED · READY TO LAUNCH
            </div>
            <button class="btn-disarm" on:click={disarmRocket}>DISARM</button>
        {:else if $simulating}
            <div class="sim-running-indicator">
                <span class="pulse-dot"></span>
                {$flightPhase}
            </div>
        {/if}
    </div>
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
        flex: 1;
        min-height: 0;
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

    /* Specs table */
    .specs-grid {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 8px 16px;
        align-items: baseline;
    }

    .spec-label {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 1px;
        color: #94a3b8;
        text-transform: uppercase;
        white-space: nowrap;
    }

    .spec-value {
        font-size: 1rem;
        font-weight: 700;
        color: #38bdf8;
        letter-spacing: 0.05em;
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

    .btn-arm-safety {
        padding: 10px 28px;
        border-radius: 5px;
        border: 1px solid #4ade80;
        background: rgba(74, 222, 128, 0.08);
        color: #4ade80;
        font-family: "Courier New", Courier, monospace;
        font-size: 0.9rem;
        font-weight: 800;
        letter-spacing: 0.12em;
        cursor: pointer;
        transition: all 0.2s ease;
        text-transform: uppercase;
    }

    .btn-arm-safety:hover {
        background: rgba(74, 222, 128, 0.2);
        box-shadow: 0 0 12px rgba(74, 222, 128, 0.5);
    }

    .btn-disarm {
        padding: 6px 16px;
        border-radius: 5px;
        border: 1px solid #f87171;
        background: transparent;
        color: #f87171;
        font-family: "Courier New", Courier, monospace;
        font-size: 0.8rem;
        font-weight: 800;
        letter-spacing: 0.1em;
        cursor: pointer;
        transition: all 0.2s ease;
        text-transform: uppercase;
    }

    .btn-disarm:hover {
        background: rgba(248, 113, 113, 0.12);
        border-color: #fca5a5;
        color: #fca5a5;
    }

    .armed-indicator {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.85rem;
        font-weight: 800;
        letter-spacing: 0.12em;
        color: #4ade80;
    }

    .ready-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #4ade80;
        box-shadow: 0 0 6px #4ade80;
    }

    .action-hint {
        font-size: 10px;
        color: #475569;
        letter-spacing: 1px;
    }

    .sim-running-indicator {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.8rem;
        font-weight: 800;
        letter-spacing: 0.12em;
        color: #4ade80;
    }

    .pulse-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #4ade80;
        animation: pulse 1s ease-in-out infinite;
    }

    @keyframes pulse {
        0%,
        100% {
            opacity: 1;
            transform: scale(1);
        }
        50% {
            opacity: 0.3;
            transform: scale(0.7);
        }
    }
</style>
