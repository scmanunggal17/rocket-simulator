<script lang="ts">
    export let title: string;
    export let unit: string;
    export let x: number;
    export let y: number;
    export let z: number;
    export let maxAbs: number;
    // Optional alert thresholds — set to Infinity to disable coloring
    export let warnAt: number = Infinity;
    export let critAt: number = Infinity;
    export let decimals: number = 2;

    function barPct(val: number): number {
        return Math.min((Math.abs(val) / maxAbs) * 50, 50);
    }

    function color(val: number): string {
        if (Math.abs(val) >= critAt) return "#ff4444";
        if (Math.abs(val) >= warnAt) return "#ffaa00";
        return "#00ff00";
    }

    function fmt(val: number): string {
        return val.toFixed(decimals);
    }
</script>

<div class="sensor-panel">
    <div class="sensor-header">
        <span class="sensor-title">{title}</span>
        <span class="sensor-unit">{unit}</span>
    </div>
    {#each [{ label: "X", val: x }, { label: "Y", val: y }, { label: "Z", val: z }] as axis}
        <div class="sensor-row-item">
            <span class="axis-label">{axis.label}</span>
            <div class="bar-track">
                <div class="bar-center"></div>
                <div
                    class="bar-fill {axis.val >= 0 ? 'pos' : 'neg'}"
                    style="width: {barPct(axis.val)}%"
                ></div>
            </div>
            <span class="axis-val" style="color: {color(axis.val)}"
                >{fmt(axis.val)}</span
            >
        </div>
    {/each}
</div>

<style>
    .sensor-panel {
        background-color: #111;
        border-radius: 8px;
        padding: 12px 16px;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
        min-width: 200px;
        flex: 1;
    }

    .sensor-header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: 10px;
        border-bottom: 1px solid #333;
        padding-bottom: 6px;
    }

    .sensor-title {
        color: #aaa;
        font-size: 10px;
        font-weight: bold;
        letter-spacing: 1.5px;
        font-family: "Courier New", Courier, monospace;
    }

    .sensor-unit {
        color: #555;
        font-size: 10px;
        font-family: "Courier New", Courier, monospace;
    }

    .sensor-row-item {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
    }

    .axis-label {
        color: #888;
        font-size: 11px;
        font-family: "Courier New", Courier, monospace;
        font-weight: bold;
        width: 12px;
        text-align: center;
    }

    .bar-track {
        flex: 1;
        height: 8px;
        background-color: #1a1a1a;
        border: 1px solid #333;
        border-radius: 4px;
        position: relative;
        overflow: hidden;
    }

    .bar-center {
        position: absolute;
        left: 50%;
        top: 0;
        width: 1px;
        height: 100%;
        background-color: #444;
    }

    .bar-fill {
        position: absolute;
        top: 0;
        height: 100%;
    }

    .bar-fill.pos {
        left: 50%;
        background: linear-gradient(to right, #007733, #00ff66);
    }

    .bar-fill.neg {
        right: 50%;
        background: linear-gradient(to left, #773300, #ff6600);
    }

    .axis-val {
        font-family: "Courier New", Courier, monospace;
        font-weight: bold;
        font-size: 12px;
        min-width: 58px;
        text-align: right;
    }
</style>
