<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import {
        currentAltitude,
        verticalSpeed,
        maxAltitude,
    } from "../stores/flightStore";
    import { roll, pitch, yaw } from "../stores/imuStore";
    import { connected } from "../stores/telemetryStore";

    // ── Canvas refs ───────────────────────────────────────────────────────────
    let arcCanvas: HTMLCanvasElement;
    let rocketCanvas: HTMLCanvasElement;
    let rafId: number;

    // ── Trail data ────────────────────────────────────────────────────────────
    interface TrailPoint {
        t: number;
        alt: number;
        vz: number;
    }
    let trail: TrailPoint[] = [];
    let missionTime = 0;
    let lastTs = 0;
    const MAX_TRAIL = 2000;

    // ── Reactive snapshot of stores ───────────────────────────────────────────
    let _alt = 0,
        _vz = 0,
        _maxAlt = 0;
    let _roll = 0,
        _pitch = 0,
        _yaw = 0;

    const unsubs = [
        currentAltitude.subscribe((v) => {
            // a hard reset to 0 (from resetSimulation/abortSimulation) clears the trail
            if (v === 0 && _alt > 0) {
                trail = [];
                missionTime = 0;
                lastTs = 0;
            }
            _alt = v;
        }),
        verticalSpeed.subscribe((v) => (_vz = v)),
        maxAltitude.subscribe((v) => (_maxAlt = v)),
        roll.subscribe((v) => (_roll = v)),
        pitch.subscribe((v) => (_pitch = v)),
        yaw.subscribe((v) => (_yaw = v)),
        connected.subscribe((v) => {
            if (!v) {
                trail = [];
                missionTime = 0;
                lastTs = 0;
            }
        }),
    ];

    // ── Colour helpers ────────────────────────────────────────────────────────
    function phaseColor(vz: number, alt: number): string {
        if (alt < 5) return "#4ade80"; // ground / landed
        if (alt < 50 && vz > 50) return "#f97316"; // boost
        if (vz > 5) return "#f97316"; // ascending
        if (vz > -10) return "#a78bfa"; // apogee
        return "#38bdf8"; // descent
    }

    // ── Draw arc panel ────────────────────────────────────────────────────────
    function drawArc() {
        const cv = arcCanvas;
        if (!cv) return;
        const ctx = cv.getContext("2d")!;
        const W = cv.width,
            H = cv.height;
        const PAD = { top: 24, right: 20, bottom: 32, left: 52 };
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

        // Altitude axis labels
        const dispMax = Math.max(_maxAlt, 100);
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
        ctx.fillText("m", PAD.left - 4, PAD.top - 8);

        // Time axis labels
        ctx.textAlign = "center";
        if (trail.length > 1) {
            const tMax = trail[trail.length - 1].t;
            const steps = Math.min(6, Math.floor(tMax / 10) + 1);
            for (let i = 0; i <= steps; i++) {
                const tv = (tMax / steps) * i;
                const x = PAD.left + fw * (tv / tMax);
                ctx.fillText(tv.toFixed(0) + "s", x, H - 6);
            }
        }

        // Trail line
        if (trail.length > 1) {
            const tMax = trail[trail.length - 1].t || 1;
            ctx.lineWidth = 2;
            ctx.lineJoin = "round";
            ctx.lineCap = "round";

            // Gradient stroke by phase
            for (let i = 1; i < trail.length; i++) {
                const p0 = trail[i - 1],
                    p1 = trail[i];
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

            // Current position dot
            const last = trail[trail.length - 1];
            const cx = PAD.left + fw * (last.t / tMax);
            const cy = PAD.top + fh * (1 - last.alt / dispMax);
            ctx.beginPath();
            ctx.arc(cx, cy, 5, 0, Math.PI * 2);
            ctx.fillStyle = phaseColor(_vz, _alt);
            ctx.fill();
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        // Axes
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(PAD.left, PAD.top);
        ctx.lineTo(PAD.left, PAD.top + fh);
        ctx.lineTo(PAD.left + fw, PAD.top + fh);
        ctx.stroke();

        // Live readout
        ctx.fillStyle = "#e2e8f0";
        ctx.font = "bold 11px 'Courier New'";
        ctx.textAlign = "left";
        ctx.fillText(
            `ALT ${_alt.toFixed(0)} m  |  V ${_vz >= 0 ? "+" : ""}${_vz.toFixed(1)} m/s  |  MAX ${_maxAlt.toFixed(0)} m`,
            PAD.left + 6,
            PAD.top - 8,
        );
    }

    // ── Draw 3-D rocket silhouette ────────────────────────────────────────────
    function drawRocket() {
        const cv = rocketCanvas;
        if (!cv) return;
        const ctx = cv.getContext("2d")!;
        const W = cv.width,
            H = cv.height;
        ctx.clearRect(0, 0, W, H);

        const cx = W / 2,
            cy = H / 2;
        // Convert pitch from "up from horizon" to rotation from canvas Y-axis
        // pitch=90 → straight up → angle=0, pitch=0 → horizontal → angle=90
        const pitchRad = ((90 - _pitch) * Math.PI) / 180;
        const rollRad = (_roll * Math.PI) / 180;
        const bodyLen = Math.min(W, H) * 0.52;
        const bodyRad = bodyLen * 0.085;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(pitchRad); // pitch rotation (nose-up/down)

        // ── Shadow/glow ───────────────────────────────────────────────────────
        const grd = ctx.createRadialGradient(
            0,
            0,
            bodyRad * 0.5,
            0,
            0,
            bodyLen * 0.7,
        );
        grd.addColorStop(0, "rgba(56,189,248,0.08)");
        grd.addColorStop(1, "rgba(56,189,248,0)");
        ctx.beginPath();
        ctx.ellipse(0, 0, bodyLen * 0.55, bodyLen * 0.55, 0, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();

        const col = phaseColor(_vz, _alt);
        const noseLen = bodyLen * 0.32;
        const finHeight = bodyLen * 0.22;
        const finWidth = bodyRad * 1.6;
        const noseTipY = -(bodyLen / 2 + noseLen);
        const tailY = bodyLen / 2;
        const shoulderY = -bodyLen / 2;

        // ── Roll indicator (thin ring around body) ────────────────────────────
        ctx.save();
        ctx.rotate(rollRad);
        ctx.beginPath();
        ctx.arc(0, 0, bodyRad * 1.55, -0.3, 0.3);
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.restore();

        // ── Fins ─────────────────────────────────────────────────────────────
        ctx.fillStyle = "rgba(148,163,184,0.5)";
        ctx.strokeStyle = col;
        ctx.lineWidth = 1;

        // Left fin
        ctx.beginPath();
        ctx.moveTo(-bodyRad, tailY);
        ctx.lineTo(-bodyRad - finWidth, tailY + finHeight * 0.4);
        ctx.lineTo(-bodyRad - finWidth, tailY - finHeight * 0.5);
        ctx.lineTo(-bodyRad, tailY - finHeight * 0.8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Right fin
        ctx.beginPath();
        ctx.moveTo(bodyRad, tailY);
        ctx.lineTo(bodyRad + finWidth, tailY + finHeight * 0.4);
        ctx.lineTo(bodyRad + finWidth, tailY - finHeight * 0.5);
        ctx.lineTo(bodyRad, tailY - finHeight * 0.8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // ── Body tube ─────────────────────────────────────────────────────────
        const bodyGrd = ctx.createLinearGradient(-bodyRad, 0, bodyRad, 0);
        bodyGrd.addColorStop(0, "rgba(15,23,42,0.9)");
        bodyGrd.addColorStop(0.35, "rgba(51,65,85,0.95)");
        bodyGrd.addColorStop(0.65, "rgba(71,85,105,0.95)");
        bodyGrd.addColorStop(1, "rgba(15,23,42,0.9)");

        ctx.beginPath();
        ctx.roundRect(-bodyRad, shoulderY, bodyRad * 2, bodyLen, 3);
        ctx.fillStyle = bodyGrd;
        ctx.fill();
        ctx.strokeStyle = "rgba(148,163,184,0.3)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Body band details
        const bands = [0.2, 0.5, 0.75];
        for (const b of bands) {
            const by = shoulderY + bodyLen * b;
            ctx.beginPath();
            ctx.moveTo(-bodyRad, by);
            ctx.lineTo(bodyRad, by);
            ctx.strokeStyle = "rgba(148,163,184,0.15)";
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // ── Nosecone ──────────────────────────────────────────────────────────
        const noseGrd = ctx.createLinearGradient(
            -bodyRad,
            shoulderY,
            bodyRad,
            noseTipY,
        );
        noseGrd.addColorStop(0, "rgba(51,65,85,0.95)");
        noseGrd.addColorStop(1, col + "cc");

        ctx.beginPath();
        ctx.moveTo(-bodyRad, shoulderY);
        ctx.bezierCurveTo(
            -bodyRad,
            shoulderY - noseLen * 0.3,
            -bodyRad * 0.3,
            noseTipY + noseLen * 0.15,
            0,
            noseTipY,
        );
        ctx.bezierCurveTo(
            bodyRad * 0.3,
            noseTipY + noseLen * 0.15,
            bodyRad,
            shoulderY - noseLen * 0.3,
            bodyRad,
            shoulderY,
        );
        ctx.closePath();
        ctx.fillStyle = noseGrd;
        ctx.fill();
        ctx.strokeStyle = col;
        ctx.lineWidth = 1;
        ctx.stroke();

        // ── Engine plume (boost only) ─────────────────────────────────────────
        if (_alt > 5 && _vz > 30) {
            const plumeLen = bodyLen * (0.3 + Math.random() * 0.12);
            const plumeGrd = ctx.createLinearGradient(
                0,
                tailY,
                0,
                tailY + plumeLen,
            );
            plumeGrd.addColorStop(0, "rgba(255,255,255,0.9)");
            plumeGrd.addColorStop(0.15, "rgba(255,200,50,0.85)");
            plumeGrd.addColorStop(0.5, "rgba(249,115,22,0.6)");
            plumeGrd.addColorStop(1, "rgba(249,115,22,0)");

            ctx.beginPath();
            ctx.moveTo(-bodyRad * 0.55, tailY);
            ctx.quadraticCurveTo(
                -bodyRad * 0.8,
                tailY + plumeLen * 0.5,
                0,
                tailY + plumeLen,
            );
            ctx.quadraticCurveTo(
                bodyRad * 0.8,
                tailY + plumeLen * 0.5,
                bodyRad * 0.55,
                tailY,
            );
            ctx.fillStyle = plumeGrd;
            ctx.fill();
        }

        // ── Drogue/main chute ─────────────────────────────────────────────────
        if (_alt > 20 && _vz < -3) {
            const isMain = _vz > -20;
            const chuteR = isMain ? bodyLen * 0.45 : bodyLen * 0.22;
            const chuteY = noseTipY - chuteR * 0.6;
            // Lines from nose to chute
            const lineCount = isMain ? 6 : 4;
            ctx.strokeStyle = "rgba(148,163,184,0.4)";
            ctx.lineWidth = 0.8;
            for (let i = 0; i < lineCount; i++) {
                const angle = -Math.PI / 2 + (Math.PI / (lineCount - 1)) * i;
                ctx.beginPath();
                ctx.moveTo(0, noseTipY);
                ctx.lineTo(Math.cos(angle) * chuteR + 0, chuteY);
                ctx.stroke();
            }
            // Canopy
            const chuteCol = isMain ? "#4ade80" : "#fbbf24";
            ctx.beginPath();
            ctx.arc(0, chuteY, chuteR, Math.PI, 0);
            ctx.fillStyle = chuteCol + "55";
            ctx.fill();
            ctx.strokeStyle = chuteCol;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        ctx.restore();

        // ── Attitude readout ──────────────────────────────────────────────────
        ctx.fillStyle = "#94a3b8";
        ctx.font = "10px 'Courier New'";
        ctx.textAlign = "left";
        ctx.fillText(`P ${_pitch.toFixed(1)}°`, 8, H - 32);
        ctx.fillText(`R ${_roll.toFixed(1)}°`, 8, H - 20);
        ctx.fillText(`Y ${_yaw.toFixed(1)}°`, 8, H - 8);
    }

    // ── Animation loop ────────────────────────────────────────────────────────
    function tick(ts: number) {
        if (lastTs === 0) lastTs = ts;
        const dt = Math.min((ts - lastTs) / 1000, 0.1);
        lastTs = ts;

        if (_alt > 1 || trail.length > 0) {
            missionTime += dt;
            trail.push({ t: missionTime, alt: _alt, vz: _vz });
            if (trail.length > MAX_TRAIL) trail.shift();
        }

        drawArc();
        drawRocket();
        rafId = requestAnimationFrame(tick);
    }

    // ── Resize helper ─────────────────────────────────────────────────────────
    function resize() {
        if (!arcCanvas || !rocketCanvas) return;
        const arcWrap = arcCanvas.parentElement!;
        const rocketWrap = rocketCanvas.parentElement!;
        arcCanvas.width = arcWrap.clientWidth;
        arcCanvas.height = arcWrap.clientHeight;
        rocketCanvas.width = rocketWrap.clientWidth;
        rocketCanvas.height = rocketWrap.clientHeight;
    }

    let resizeObs: ResizeObserver;

    onMount(() => {
        resize();
        resizeObs = new ResizeObserver(resize);
        if (arcCanvas.parentElement)
            resizeObs.observe(arcCanvas.parentElement!);
        if (rocketCanvas.parentElement)
            resizeObs.observe(rocketCanvas.parentElement!);
        rafId = requestAnimationFrame(tick);
    });

    onDestroy(() => {
        cancelAnimationFrame(rafId);
        resizeObs?.disconnect();
        unsubs.forEach((u) => u());
    });
</script>

<div class="traj-root">
    <!-- Left: 3-D rocket silhouette -->
    <div class="rocket-view">
        <div class="panel-label">ATTITUDE</div>
        <div class="canvas-wrap">
            <canvas bind:this={rocketCanvas}></canvas>
        </div>
    </div>

    <!-- Right: altitude arc -->
    <div class="arc-view">
        <div class="panel-label">TRAJECTORY</div>
        <div class="canvas-wrap">
            <canvas bind:this={arcCanvas}></canvas>
        </div>
    </div>
</div>

<style>
    .traj-root {
        display: flex;
        width: 100%;
        height: 100%;
        gap: 8px;
        padding: 8px;
        box-sizing: border-box;
        background: transparent;
        overflow: hidden;
    }

    .rocket-view {
        width: 200px;
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .arc-view {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .panel-label {
        font-family: "Courier New", monospace;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 2px;
        color: #475569;
        flex-shrink: 0;
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
</style>
