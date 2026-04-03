<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { OpenLogFile } from "../../../wailsjs/go/main/App";
    import type { FlightLog } from "../stores/flightLogStore";

    let log: FlightLog | null = null;
    let errorMsg = "";
    let loading = false;

    let arcCanvas: HTMLCanvasElement;
    let resizeObs: ResizeObserver;

    // ── Colour by vertical speed / altitude (mirrors TrajectoryPanel) ─────────
    function phaseColor(vz: number, alt: number): string {
        if (alt < 5) return "#4ade80";
        if (alt < 50 && vz > 50) return "#f97316";
        if (vz > 5) return "#f97316";
        if (vz > -10) return "#a78bfa";
        return "#38bdf8";
    }

    // ── Draw the altitude arc from log telemetry ──────────────────────────────
    function drawArc() {
        const cv = arcCanvas;
        if (!cv || !log) return;
        const ctx = cv.getContext("2d")!;
        const W = cv.width,
            H = cv.height;
        const PAD = { top: 28, right: 20, bottom: 36, left: 56 };
        const fw = W - PAD.left - PAD.right;
        const fh = H - PAD.top - PAD.bottom;

        ctx.clearRect(0, 0, W, H);

        // Background grid
        ctx.strokeStyle = "rgba(51,65,85,0.5)";
        ctx.lineWidth = 1;
        const gridLines = 5;
        for (let i = 0; i <= gridLines; i++) {
            const y = PAD.top + (fh / gridLines) * i;
            ctx.beginPath();
            ctx.moveTo(PAD.left, y);
            ctx.lineTo(PAD.left + fw, y);
            ctx.stroke();
        }

        const dispMax = Math.max(log.summary.maxAltitude, 100);

        // Altitude axis labels
        ctx.fillStyle = "#94a3b8";
        ctx.font = "10px 'Courier New'";
        ctx.textAlign = "right";
        for (let i = 0; i <= gridLines; i++) {
            const v = (dispMax / gridLines) * (gridLines - i);
            const y = PAD.top + (fh / gridLines) * i;
            ctx.fillText(
                v >= 1000 ? (v / 1000).toFixed(1) + "k" : v.toFixed(0),
                PAD.left - 4,
                y + 4,
            );
        }
        ctx.fillText("m", PAD.left - 4, PAD.top - 10);

        const tele = log.telemetry;

        // Time axis labels
        if (tele.length > 1) {
            const tMax = tele[tele.length - 1].t;
            const steps = Math.min(6, Math.floor(tMax / 10) + 1);
            ctx.textAlign = "center";
            for (let i = 0; i <= steps; i++) {
                const tv = (tMax / steps) * i;
                const x = PAD.left + fw * (tv / tMax);
                ctx.fillText(tv.toFixed(0) + "s", x, H - 6);
            }
        }

        // Phase event vertical lines
        if (tele.length > 1) {
            const tMax = tele[tele.length - 1].t || 1;
            const phaseLineColors: Record<string, string> = {
                BOOST: "#f97316",
                COAST: "#38bdf8",
                APOGEE: "#a78bfa",
                DESCENT: "#fb923c",
                LANDED: "#4ade80",
            };
            ctx.font = "9px 'Courier New'";
            ctx.textAlign = "left";
            for (const ev of log.events) {
                if (ev.t === 0) continue;
                const x = PAD.left + fw * (ev.t / tMax);
                const col = phaseLineColors[ev.phase] ?? "#475569";
                ctx.strokeStyle = col + "66";
                ctx.lineWidth = 1;
                ctx.setLineDash([3, 3]);
                ctx.beginPath();
                ctx.moveTo(x, PAD.top);
                ctx.lineTo(x, PAD.top + fh);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.fillStyle = col;
                ctx.fillText(ev.phase, x + 2, PAD.top + 10);
            }
        }

        // Trail line
        if (tele.length > 1) {
            const tMax = tele[tele.length - 1].t || 1;
            ctx.lineWidth = 2;
            ctx.lineJoin = "round";
            ctx.lineCap = "round";

            for (let i = 1; i < tele.length; i++) {
                const p0 = tele[i - 1],
                    p1 = tele[i];
                const x0 = PAD.left + fw * (p0.t / tMax);
                const y0 = PAD.top + fh * (1 - p0.alt / dispMax);
                const x1 = PAD.left + fw * (p1.t / tMax);
                const y1 = PAD.top + fh * (1 - p1.alt / dispMax);
                ctx.strokeStyle = phaseColor(p1.vz, p1.alt);
                ctx.beginPath();
                ctx.moveTo(x0, y0);
                ctx.lineTo(x1, y1);
                ctx.stroke();
            }

            // Apogee dot
            const apogeeEv = log.events.find((e) => e.phase === "APOGEE");
            if (apogeeEv) {
                const tMax2 = tele[tele.length - 1].t || 1;
                const closest = tele.reduce((a, b) =>
                    Math.abs(b.t - apogeeEv.t) < Math.abs(a.t - apogeeEv.t)
                        ? b
                        : a,
                );
                const cx = PAD.left + fw * (closest.t / tMax2);
                const cy = PAD.top + fh * (1 - closest.alt / dispMax);
                ctx.beginPath();
                ctx.arc(cx, cy, 5, 0, Math.PI * 2);
                ctx.fillStyle = "#a78bfa";
                ctx.fill();
                ctx.strokeStyle = "#fff";
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
        }

        // Axes
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(PAD.left, PAD.top);
        ctx.lineTo(PAD.left, PAD.top + fh);
        ctx.lineTo(PAD.left + fw, PAD.top + fh);
        ctx.stroke();

        // Header readout
        ctx.fillStyle = "#e2e8f0";
        ctx.font = "bold 11px 'Courier New'";
        ctx.textAlign = "left";
        ctx.fillText(
            `MAX ${log.summary.maxAltitude.toFixed(0)} m  |  DURATION ${log.summary.flightDuration.toFixed(1)} s  |  DOWNRANGE ${log.summary.downrangeDistance.toFixed(0)} m`,
            PAD.left + 4,
            PAD.top - 10,
        );
    }

    function resize() {
        if (!arcCanvas) return;
        const wrap = arcCanvas.parentElement!;
        arcCanvas.width = wrap.clientWidth;
        arcCanvas.height = wrap.clientHeight;
        drawArc();
    }

    onMount(() => {
        resizeObs = new ResizeObserver(resize);
        if (arcCanvas?.parentElement)
            resizeObs.observe(arcCanvas.parentElement);
    });

    onDestroy(() => {
        resizeObs?.disconnect();
    });

    async function openFile() {
        errorMsg = "";
        loading = true;
        try {
            const raw = await OpenLogFile();
            if (!raw) {
                loading = false;
                return; // user cancelled
            }
            log = JSON.parse(raw) as FlightLog;
            // Wait for canvas to be visible, then draw
            setTimeout(() => resize(), 50);
        } catch (e) {
            errorMsg = "Failed to open or parse log file.";
            log = null;
        }
        loading = false;
    }

    function formatDate(iso: string): string {
        try {
            return new Date(iso).toLocaleString();
        } catch {
            return iso;
        }
    }
</script>

<div class="replay-root">
    <div class="toolbar">
        <button class="btn-open" on:click={openFile} disabled={loading}>
            {loading ? "LOADING..." : "⏏ OPEN LOG FILE"}
        </button>
        {#if log}
            <span class="log-id">{log.meta.id}</span>
            <span class="log-date">{formatDate(log.meta.date)}</span>
            <span class="log-source source-{log.meta.source}"
                >{log.meta.source === "sim" ? "SIMULATION" : "CONTROLLER"}</span
            >
        {/if}
        {#if errorMsg}
            <span class="error-msg">{errorMsg}</span>
        {/if}
    </div>

    {#if log}
        <div class="content">
            <!-- Arc chart -->
            <div class="chart-area">
                <div class="section-label">TRAJECTORY REPLAY</div>
                <div class="canvas-wrap">
                    <canvas bind:this={arcCanvas}></canvas>
                </div>
            </div>

            <!-- Info columns -->
            <div class="info-area">
                <div class="info-col">
                    <div class="section-label">SUMMARY</div>
                    <div class="kv-list">
                        <div class="kv">
                            <span class="k">Max Altitude</span>
                            <span class="v"
                                >{log.summary.maxAltitude.toFixed(1)} m</span
                            >
                        </div>
                        <div class="kv">
                            <span class="k">Max Vert. Speed</span>
                            <span class="v"
                                >{log.summary.maxVerticalSpeed.toFixed(1)} m/s</span
                            >
                        </div>
                        <div class="kv">
                            <span class="k">Flight Duration</span>
                            <span class="v"
                                >{log.summary.flightDuration.toFixed(2)} s</span
                            >
                        </div>
                        <div class="kv">
                            <span class="k">Downrange</span>
                            <span class="v"
                                >{log.summary.downrangeDistance.toFixed(1)} m</span
                            >
                        </div>
                    </div>

                    <div class="section-label" style="margin-top:16px">
                        PHASES
                    </div>
                    <div class="kv-list">
                        {#each log.events as ev}
                            <div class="kv">
                                <span class="k phase-name phase-{ev.phase}"
                                    >{ev.phase}</span
                                >
                                <span class="v">T+{ev.t.toFixed(1)} s</span>
                            </div>
                        {/each}
                    </div>
                </div>

                <div class="info-col">
                    <div class="section-label">CONFIGURATION</div>
                    <div class="kv-list">
                        <div class="kv">
                            <span class="k">Alt Abs</span>
                            <span class="v">{log.config.altitudeAbs} m ASL</span
                            >
                        </div>
                        <div class="kv">
                            <span class="k">Alt Rel</span>
                            <span class="v">{log.config.altitudeRel} m AGL</span
                            >
                        </div>
                        <div class="kv">
                            <span class="k">Pitch</span>
                            <span class="v">{log.config.pitch}°</span>
                        </div>
                        <div class="kv">
                            <span class="k">Roll</span>
                            <span class="v">{log.config.roll}°</span>
                        </div>
                        <div class="kv">
                            <span class="k">Yaw</span>
                            <span class="v">{log.config.yaw}°</span>
                        </div>
                        <div class="kv">
                            <span class="k">Dry Mass</span>
                            <span class="v">{log.config.dryMass} kg</span>
                        </div>
                        <div class="kv">
                            <span class="k">Fuel Mass</span>
                            <span class="v">{log.config.fuelMass} kg</span>
                        </div>
                        <div class="kv">
                            <span class="k">Thrust</span>
                            <span class="v">{log.config.thrust} N</span>
                        </div>
                        <div class="kv">
                            <span class="k">Burn Time</span>
                            <span class="v">{log.config.burnTime} s</span>
                        </div>
                        <div class="kv">
                            <span class="k">Countdown</span>
                            <span class="v"
                                >{log.config.countdownDuration} s</span
                            >
                        </div>
                        <div class="kv">
                            <span class="k">Lat / Lon</span>
                            <span class="v"
                                >{log.config.lat.toFixed(4)}, {log.config.lon.toFixed(
                                    4,
                                )}</span
                            >
                        </div>
                    </div>
                </div>
            </div>
        </div>
    {:else if !loading}
        <div class="empty-state">
            <span class="empty-icon">⏏</span>
            <span>Open a flight log file to replay trajectory data</span>
        </div>
    {/if}
</div>

<style>
    .replay-root {
        height: 100%;
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 12px;
        box-sizing: border-box;
        font-family: "Courier New", Courier, monospace;
        color: #38bdf8;
        overflow: hidden;
    }

    .toolbar {
        display: flex;
        align-items: center;
        gap: 16px;
        flex-shrink: 0;
        flex-wrap: wrap;
    }

    .btn-open {
        padding: 7px 20px;
        border-radius: 4px;
        border: 1px solid #38bdf8;
        background: rgba(56, 189, 248, 0.08);
        color: #38bdf8;
        font-family: "Courier New", Courier, monospace;
        font-size: 0.8rem;
        font-weight: 800;
        letter-spacing: 0.1em;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .btn-open:hover:not(:disabled) {
        background: rgba(56, 189, 248, 0.18);
        box-shadow: 0 0 10px rgba(56, 189, 248, 0.4);
    }

    .btn-open:disabled {
        opacity: 0.5;
        cursor: wait;
    }

    .log-id {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 1px;
        color: #e2e8f0;
    }

    .log-date {
        font-size: 10px;
        color: #64748b;
    }

    .log-source {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 1px;
        padding: 2px 8px;
        border-radius: 3px;
    }

    .source-sim {
        background: rgba(56, 189, 248, 0.12);
        color: #38bdf8;
        border: 1px solid #334155;
    }

    .source-real {
        background: rgba(74, 222, 128, 0.12);
        color: #4ade80;
        border: 1px solid #334155;
    }

    .error-msg {
        font-size: 11px;
        color: #f87171;
    }

    .content {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 12px;
        min-height: 0;
    }

    .chart-area {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .canvas-wrap {
        flex: 1;
        min-height: 0;
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid #1e293b;
        border-radius: 4px;
        overflow: hidden;
    }

    canvas {
        display: block;
        width: 100%;
        height: 100%;
    }

    .info-area {
        display: flex;
        gap: 24px;
        flex-shrink: 0;
        border-top: 1px solid #1e293b;
        padding-top: 12px;
        max-height: 220px;
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: #334155 transparent;
    }

    .info-col {
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
        padding-bottom: 5px;
        margin-bottom: 8px;
    }

    .kv-list {
        display: flex;
        flex-direction: column;
        gap: 5px;
    }

    .kv {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        font-size: 11px;
    }

    .k {
        color: #64748b;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        flex-shrink: 0;
    }

    .v {
        color: #e2e8f0;
        font-weight: 700;
        text-align: right;
    }

    .phase-name {
        font-weight: 700;
    }

    .phase-BOOST {
        color: #f97316;
    }
    .phase-COAST {
        color: #38bdf8;
    }
    .phase-APOGEE {
        color: #a78bfa;
    }
    .phase-DESCENT {
        color: #fb923c;
    }
    .phase-LANDED {
        color: #4ade80;
    }

    .empty-state {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        color: #334155;
        font-size: 13px;
        letter-spacing: 1px;
    }

    .empty-icon {
        font-size: 48px;
        opacity: 0.3;
    }
</style>
