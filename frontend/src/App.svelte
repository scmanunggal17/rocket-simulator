<script lang="ts">
    import SideMenu from "./lib/components/SideMenu.svelte";
    import TopPanel from "./lib/components/TopPanel.svelte";
    import SimulationPanel from "./lib/components/SimulationPanel.svelte";
    import MapsPanel from "./lib/components/MapsPanel.svelte";
    import TrajectoryPanel from "./lib/components/TrajectoryPanel.svelte";
    import {
        connected,
        rssi,
        noise,
        dataRate,
    } from "./lib/stores/telemetryStore";
    import {
        flightPhase,
        countdown,
        configured,
        armed,
        simulating,
        launchSimulation,
        abortSimulation,
        resetSimulation,
    } from "./lib/stores/simulationControl";
    import { StartMavlink, StopMavlink } from "../wailsjs/go/main/App";
    import { startMavlinkBridge } from "./lib/stores/mavlinkBridge";
    import { EventsOn } from "../wailsjs/runtime/runtime";

    // ESP32 AP always assigns itself 192.168.4.1; standard MAVLink TCP port
    const ESP32_ADDR = "192.168.4.1:5760";

    let sidePanelWidth = 440;
    let isResizing = false;
    let activeTab: "simulation" | "maps" | "trajectory" = "simulation";
    let stopBridge: (() => void) | null = null;
    let connecting = false;
    let connectError = false;

    // Handle unexpected TCP drop (ESP32 powered off, out of range, etc.)
    EventsOn("mavlink:connected", (val: boolean) => {
        if (!val && stopBridge) {
            stopBridge();
            stopBridge = null;
        }
    });

    async function handleConnect() {
        if ($connected) {
            if (stopBridge) {
                stopBridge();
                stopBridge = null;
            }
            connected.set(false);
            StopMavlink();
        } else if (!connecting) {
            connecting = true;
            connectError = false;
            // yield to the browser's paint pipeline so CONNECTING... renders
            // before the Go TCP dial blocks the JS-Go bridge (up to 5s)
            await new Promise((r) => setTimeout(r, 50));
            try {
                await StartMavlink(ESP32_ADDR);
                connecting = false;
                connected.set(true);
                stopBridge = startMavlinkBridge();
            } catch (e) {
                connecting = false;
                connectError = true;
                setTimeout(() => {
                    connectError = false;
                }, 3000);
            }
        }
    }

    const phaseColors: Record<string, string> = {
        STANDBY: "#475569",
        READY: "#38bdf8",
        COUNTDOWN: "#fbbf24",
        BOOST: "#f97316",
        COAST: "#38bdf8",
        APOGEE: "#a78bfa",
        DESCENT: "#fb923c",
        LANDED: "#4ade80",
        ABORTED: "#f87171",
    };
    $: phaseColor = phaseColors[$flightPhase] ?? "#475569";

    function startResize(e) {
        isResizing = true;
        e.preventDefault();
    }

    function onMouseMove(e) {
        if (!isResizing) return;
        let newWidth = window.innerWidth - e.clientX - 12; // 12px for container right padding
        if (newWidth < 240) newWidth = 240;
        if (newWidth > 500) newWidth = 500;
        sidePanelWidth = newWidth;
    }

    function onMouseUp() {
        isResizing = false;
    }
</script>

<svelte:window on:mousemove={onMouseMove} on:mouseup={onMouseUp} />

<div class="container" class:resizing={isResizing}>
    <header>
        <span class="title">Rocket GCS</span>
        <span
            class="phase-badge"
            style="color: {phaseColor}; border-color: {phaseColor}"
        >
            {$flightPhase}
        </span>

        <!-- Launch sequence button -->
        {#if $flightPhase === "STANDBY"}
            <button class="btn-launch" disabled>▲ LAUNCH</button>
        {:else if $flightPhase === "READY" && !$armed}
            <button
                class="btn-launch"
                disabled
                title="Arm the rocket before launching">▲ LAUNCH</button
            >
        {:else if $flightPhase === "READY" && $armed}
            <button class="btn-launch launch-ready" on:click={launchSimulation}
                >▲ LAUNCH</button
            >
        {:else if $flightPhase === "COUNTDOWN"}
            <button class="btn-launch launch-countdown" disabled
                >T–{$countdown}</button
            >
        {:else if $flightPhase === "BOOST" || $flightPhase === "COAST" || $flightPhase === "APOGEE" || $flightPhase === "DESCENT"}
            <button class="btn-launch launch-abort" on:click={abortSimulation}
                >■ ABORT</button
            >
        {:else if $flightPhase === "LANDED" || $flightPhase === "ABORTED"}
            <button class="btn-launch launch-reset" on:click={resetSimulation}
                >↺ RESET</button
            >
        {/if}
        <div class="telemetry-stats">
            <div class="telem-item">
                <span class="telem-label">RSSI</span>
                <div class="signal-bar-track">
                    <div
                        class="signal-bar-fill"
                        style="width: {$rssi}%; background: {$rssi < 30
                            ? '#ff4444'
                            : $rssi < 55
                              ? '#ffaa00'
                              : '#4ade80'}"
                    ></div>
                </div>
                <span
                    class="telem-value"
                    style="color: {$rssi < 30
                        ? '#ff4444'
                        : $rssi < 55
                          ? '#ffaa00'
                          : '#4ade80'}">{$rssi.toFixed(0)}%</span
                >
            </div>
            <div class="telem-item">
                <span class="telem-label">NOISE</span>
                <span class="telem-value">{$noise.toFixed(0)}</span>
            </div>
            <div class="telem-divider"></div>
            <div class="telem-item">
                <span class="telem-label">RATE</span>
                <span class="telem-value"
                    >{$dataRate} <span class="telem-unit">msg/s</span></span
                >
            </div>
        </div>

        <div class="conn-group">
            <span
                class="conn-status"
                class:conn-disconnected={!$connected &&
                    !connecting &&
                    !connectError}
                class:conn-connecting={connecting}
                class:conn-connected={$connected}
                class:conn-error={connectError}
            >
                <span class="conn-dot"></span>
                {#if connecting}
                    CONNECTING...
                {:else if connectError}
                    FAILED
                {:else if $connected}
                    CONNECTED
                {:else}
                    DISCONNECTED
                {/if}
            </span>
            <button
                class="btn"
                class:connected={$connected}
                disabled={connecting}
                on:click={handleConnect}
            >
                {$connected ? "DISCONNECT" : "CONNECT"}
            </button>
        </div>
    </header>
    <TopPanel />
    <main class="main-window">
        <div class="content-panel">
            <div class="tab-bar">
                <button
                    class="tab"
                    class:active={activeTab === "simulation"}
                    on:click={() => (activeTab = "simulation")}
                    >SIMULATION</button
                >
                <button
                    class="tab"
                    class:active={activeTab === "trajectory"}
                    on:click={() => (activeTab = "trajectory")}
                    >TRAJECTORY</button
                >
                <button
                    class="tab"
                    class:active={activeTab === "maps"}
                    on:click={() => (activeTab = "maps")}>MAPS</button
                >
            </div>
            <div class="tab-content">
                {#if activeTab === "simulation"}
                    <SimulationPanel />
                {:else if activeTab === "trajectory"}
                    <TrajectoryPanel />
                {:else}
                    <MapsPanel />
                {/if}
            </div>
        </div>
        <div class="resizer" on:mousedown={startResize}></div>
        <div class="side-panel" style="width: {sidePanelWidth}px">
            <SideMenu />
        </div>
    </main>
</div>

<style>
    .container {
        height: 100vh;
        padding: 12px;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 12px;
        font-family: "Courier New", Courier, monospace; /* Monospace for tech feel */
        color: #38bdf8; /* Bright blue text */
        overflow: hidden;
        background: radial-gradient(
            circle at 50% 50%,
            #1e293b 0%,
            #020617 100%
        );
    }

    header {
        display: flex;
        align-items: center;
        gap: 15px;
        padding: 8px 16px;
        background: rgba(30, 41, 59, 0.8);
        border: 1px solid #334155;
        border-bottom: 2px solid #38bdf8; /* Blue accent border */
        border-radius: 4px;
        flex-shrink: 0;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    }

    .main-window {
        display: flex;
        gap: 4px;
        flex: 1;
        min-height: 0;
        overflow: hidden;
    }

    .title {
        font-size: 1.25rem;
        font-weight: 700;
        letter-spacing: 0.15em;
        margin-right: auto;
        text-shadow: 0 0 8px rgba(56, 189, 248, 0.5); /* Glowing text */
    }

    .btn {
        padding: 6px 16px;
        border-radius: 5px;
        border: 1px solid #38bdf8;
        background: transparent;
        color: #38bdf8;
        font-family: "Courier New", Courier, monospace;
        font-size: 0.8rem;
        font-weight: 800;
        letter-spacing: 0.1em;
        cursor: pointer;
        transition: all 0.2s ease;
        text-transform: uppercase;
    }

    .phase-badge {
        font-size: 0.8rem;
        font-weight: 800;
        min-width: 100px;
        height: 30px;
        align-content: center;
        text-align: center;
        letter-spacing: 0.1em;
        padding: 3px 10px;
        border-radius: 5px;
        background: rgba(0, 0, 0, 0.4);
        border: 1px solid #475569;
        transition:
            color 0.3s,
            border-color 0.3s;
    }

    .btn:hover {
        background: rgba(56, 189, 248, 0.1);
        box-shadow: 0 0 10px rgba(56, 189, 248, 0.4);
    }

    .btn.connected {
        border-color: #4ade80;
        color: #4ade80;
    }

    .btn.connected:hover {
        background: rgba(74, 222, 128, 0.1);
        box-shadow: 0 0 10px rgba(74, 222, 128, 0.4);
    }

    .btn:disabled {
        opacity: 0.5;
        cursor: wait;
    }

    /* Connection group: status pill + button */
    .conn-group {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .conn-status {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 0.1em;
        padding: 3px 8px;
        border-radius: 4px;
        border: 1px solid #334155;
        background: rgba(0, 0, 0, 0.3);
        white-space: nowrap;
    }

    .conn-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: currentColor;
        flex-shrink: 0;
    }

    .conn-disconnected {
        color: #475569;
        border-color: #334155;
    }

    .conn-connecting {
        color: #fbbf24;
        border-color: #fbbf24;
        animation: pulse-conn 1s ease-in-out infinite;
    }

    .conn-connected {
        color: #4ade80;
        border-color: #4ade80;
    }

    .conn-error {
        color: #f87171;
        border-color: #f87171;
    }

    @keyframes pulse-conn {
        0%,
        100% {
            opacity: 1;
        }
        50% {
            opacity: 0.4;
        }
    }

    /* Launch sequence button */
    .btn-launch {
        padding: 6px 18px;
        border-radius: 5px;
        border: 1px solid #475569;
        background: transparent;
        color: #475569;
        font-family: "Courier New", Courier, monospace;
        font-size: 0.8rem;
        font-weight: 800;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        cursor: not-allowed;
        transition: all 0.2s ease;
    }

    .btn-launch.launch-ready {
        border-color: #4ade80;
        color: #4ade80;
        cursor: pointer;
    }
    .btn-launch.launch-ready:hover {
        background: rgba(74, 222, 128, 0.12);
        box-shadow: 0 0 12px rgba(74, 222, 128, 0.5);
    }

    .btn-launch.launch-countdown {
        border-color: #fbbf24;
        color: #fbbf24;
        cursor: not-allowed;
        animation: blink-border 0.6s ease-in-out infinite;
    }
    @keyframes blink-border {
        0%,
        100% {
            box-shadow: 0 0 6px rgba(251, 191, 36, 0.6);
        }
        50% {
            box-shadow: none;
        }
    }

    .btn-launch.launch-abort {
        border-color: #ff4444;
        color: #ff4444;
        cursor: pointer;
    }
    .btn-launch.launch-abort:hover {
        background: rgba(255, 68, 68, 0.12);
        box-shadow: 0 0 10px rgba(255, 68, 68, 0.5);
    }

    .btn-launch.launch-reset {
        border-color: #4ade80;
        color: #4ade80;
        cursor: pointer;
    }
    .btn-launch.launch-reset:hover {
        background: rgba(74, 222, 128, 0.12);
        box-shadow: 0 0 10px rgba(74, 222, 128, 0.5);
    }

    .telemetry-stats {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 0 8px;
    }

    .telem-item {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .telem-label {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 1px;
        color: #94a3b8;
        text-transform: uppercase;
        white-space: nowrap;
    }

    .telem-value {
        font-size: 0.8rem;
        font-weight: 700;
        color: #38bdf8;
        letter-spacing: 0.05em;
        white-space: nowrap;
    }

    .telem-unit {
        font-size: 8px;
        color: #475569;
        letter-spacing: 1px;
        text-transform: uppercase;
    }

    .signal-bar-track {
        width: 40px;
        height: 6px;
        background: #0f172a;
        border-radius: 3px;
        overflow: hidden;
        border: 1px solid #1e293b;
    }

    .signal-bar-fill {
        height: 100%;
        border-radius: 3px;
        transition:
            width 0.4s ease,
            background 0.4s ease;
    }

    .telem-divider {
        width: 1px;
        height: 20px;
        background: #1e293b;
    }

    .container.resizing {
        cursor: col-resize;
        user-select: none;
    }

    .content-panel {
        flex: 1;
        background: rgba(0, 0, 0, 0.4);
        border: 1px solid #334155;
        border-radius: 4px;
        display: flex;
        flex-direction: column;
        min-width: 0;
        overflow: hidden;
    }

    .tab-bar {
        display: flex;
        border-bottom: 1px solid #334155;
        flex-shrink: 0;
    }

    .tab {
        padding: 8px 20px;
        background: transparent;
        border: none;
        border-right: 1px solid #1e293b;
        color: #475569;
        font-family: "Courier New", Courier, monospace;
        font-size: 0.75rem;
        font-weight: 800;
        letter-spacing: 0.12em;
        cursor: pointer;
        transition: all 0.2s ease;
        text-transform: uppercase;
    }

    .tab:hover {
        color: #94a3b8;
        background: rgba(255, 255, 255, 0.03);
    }

    .tab.active {
        color: #38bdf8;
        border-bottom: 2px solid #38bdf8;
        margin-bottom: -1px;
        background: rgba(56, 189, 248, 0.05);
    }

    .tab-content {
        flex: 1;
        min-height: 0;
        overflow: hidden;
    }

    .resizer {
        width: 8px;
        cursor: col-resize;
        border-radius: 4px;
        transition: background-color 0.2s;
        margin: 0 -4px;
        z-index: 10;
    }

    .resizer:hover,
    .container.resizing .resizer {
        background-color: rgba(56, 189, 248, 0.5);
    }

    .side-panel {
        background: rgba(30, 41, 59, 0.6);
        border: 1px solid #334155;
        border-radius: 4px;
        flex-shrink: 0;
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }
</style>
