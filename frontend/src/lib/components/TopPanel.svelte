<script lang="ts">
    import {
        maxAltitude,
        currentAltitude,
        fuelUsed,
        fuelCapacity,
        flightSpeed,
        flightDuration,
        verticalSpeed,
        acceleration,
        downrangeDistance,
        apogeeEta,
    } from "../stores/flightStore";

    function fmt(val: number, dec = 1): string {
        return val.toFixed(dec);
    }

    function fmtTime(s: number): string {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    }

    $: fuelPct = (($fuelCapacity - $fuelUsed) / $fuelCapacity) * 100;
    $: fuelColor =
        fuelPct < 15 ? "#ff4444" : fuelPct < 30 ? "#ffaa00" : "#38bdf8";
</script>

<div class="top-panel">
    <div class="stat-group">
        <div class="section-label">FLIGHT</div>
        <div class="stats-row">
            <div class="stat">
                <span class="stat-label">DURATION</span>
                <span class="stat-value">{fmtTime($flightDuration)}</span>
                <span class="stat-unit">mm:ss</span>
            </div>
            <div class="stat">
                <span class="stat-label">SPEED</span>
                <span class="stat-value">{fmt($flightSpeed, 0)}</span>
                <span class="stat-unit">m/s</span>
            </div>
            <div class="stat">
                <span class="stat-label">V-SPEED</span>
                <span
                    class="stat-value"
                    class:positive={$verticalSpeed > 0}
                    class:negative={$verticalSpeed < 0}
                >
                    {$verticalSpeed > 0 ? "+" : ""}{fmt($verticalSpeed, 1)}
                </span>
                <span class="stat-unit">m/s</span>
            </div>
            <div class="stat">
                <span class="stat-label">ACCEL</span>
                <span class="stat-value">{fmt($acceleration, 2)}</span>
                <span class="stat-unit">m/s²</span>
            </div>
        </div>
    </div>

    <div class="divider"></div>

    <div class="stat-group">
        <div class="section-label">ALTITUDE</div>
        <div class="stats-row">
            <div class="stat">
                <span class="stat-label">CURRENT</span>
                <span class="stat-value">{fmt($currentAltitude, 0)}</span>
                <span class="stat-unit">m</span>
            </div>
            <div class="stat">
                <span class="stat-label">MAX</span>
                <span class="stat-value highlight">{fmt($maxAltitude, 0)}</span>
                <span class="stat-unit">m</span>
            </div>
            <div class="stat">
                <span class="stat-label">DOWNRANGE</span>
                <span class="stat-value">{fmt($downrangeDistance, 2)}</span>
                <span class="stat-unit">km</span>
            </div>
            <div class="stat">
                <span class="stat-label">APOGEE ETA</span>
                <span class="stat-value">{fmt($apogeeEta, 0)}</span>
                <span class="stat-unit">s</span>
            </div>
        </div>
    </div>

    <div class="divider"></div>

    <div class="stat-group fuel-group">
        <div class="section-label">PROPULSION</div>
        <div class="stats-row">
            <div class="stat">
                <span class="stat-label">FUEL USED</span>
                <span class="stat-value">{fmt($fuelUsed, 1)}</span>
                <span class="stat-unit">kg</span>
            </div>
            <div class="stat">
                <span class="stat-label">REMAINING</span>
                <span class="stat-value" style="color: {fuelColor}"
                    >{fmt($fuelCapacity - $fuelUsed, 1)}</span
                >
                <span class="stat-unit">kg</span>
            </div>
            <div class="stat fuel-bar-stat">
                <span class="stat-label">CAPACITY</span>
                <div class="fuel-bar-track">
                    <div
                        class="fuel-bar-fill"
                        style="width: {fuelPct}%; background: {fuelColor}"
                    ></div>
                </div>
                <span class="stat-unit" style="color: {fuelColor}"
                    >{fmt(fuelPct, 0)}%</span
                >
            </div>
        </div>
    </div>
</div>

<style>
    .top-panel {
        display: flex;
        flex-direction: row;
        align-items: stretch;
        gap: 0;
        padding: 8px 14px;
        width: 100%;
        box-sizing: border-box;
        font-family: "Courier New", Courier, monospace;
        background: rgba(30, 41, 59, 0.8);
        border: 1px solid #334155;
        border-radius: 4px;
        flex-shrink: 0;
        overflow: hidden;
    }

    .stat-group {
        display: flex;
        flex-direction: column;
        gap: 5px;
        flex: 1;
        min-width: 0;
    }

    .section-label {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 2px;
        color: #475569;
        text-transform: uppercase;
        border-bottom: 1px solid #1e293b;
        padding-bottom: 3px;
    }

    .stats-row {
        display: flex;
        flex-direction: row;
        gap: 16px;
        align-items: flex-end;
        flex-wrap: wrap;
    }

    .stat {
        display: flex;
        flex-direction: column;
        gap: 1px;
        min-width: 60px;
    }

    .stat-label {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 1px;
        color: #94a3b8;
        text-transform: uppercase;
    }

    .stat-value {
        font-size: 1.25rem;
        font-weight: 700;
        color: #38bdf8;
        letter-spacing: 0.05em;
        line-height: 1;
    }

    .stat-value.highlight {
        color: #a78bfa;
    }

    .stat-value.positive {
        color: #4ade80;
    }

    .stat-value.negative {
        color: #fb923c;
    }

    .stat-unit {
        font-size: 8px;
        color: #475569;
        letter-spacing: 1px;
        text-transform: uppercase;
    }

    .divider {
        width: 1px;
        background: #1e293b;
        margin: 0 14px;
        flex-shrink: 0;
    }

    .fuel-bar-stat {
        min-width: 100px;
        flex: 1;
    }

    .fuel-bar-track {
        height: 8px;
        background: #0f172a;
        border-radius: 4px;
        overflow: hidden;
        border: 1px solid #1e293b;
        margin: 4px 0 2px;
        width: 100%;
    }

    .fuel-bar-fill {
        height: 100%;
        border-radius: 4px;
        transition:
            width 0.3s ease,
            background 0.3s ease;
    }
</style>
