<script lang="ts">
    export let roll: number = 0; // deg
    export let pitch: number = 0; // deg
    export let rollRate: number = 0; // deg/s
    export let pitchRate: number = 0; // deg/s

    const pitchLines: number[] = [];
    for (let i = -60; i <= 60; i += 10) {
        if (i !== 0) pitchLines.push(i);
    }
</script>

<div class="instrument-panel">
    <div class="instrument pfd">
        <div class="pfd-glass">
            <div
                class="pfd-roll-container"
                style="transform: rotate({roll}deg)"
            >
                <div
                    class="pfd-pitch-container"
                    style="transform: translateY({pitch * 3}px)"
                >
                    <div class="pfd-sky"></div>
                    <div class="pfd-ground"></div>
                    <div class="pfd-horizon-line"></div>

                    <div class="pitch-ladder">
                        {#each pitchLines as angle}
                            <div
                                class="pitch-line-container"
                                style="top: calc(50% - {angle * 3}px)"
                            >
                                <span class="pitch-text left"
                                    >{Math.abs(angle)}</span
                                >
                                <div
                                    class="pitch-line {angle > 0
                                        ? 'positive'
                                        : 'negative'}"
                                >
                                    <div class="tick left"></div>
                                    <div class="center-gap"></div>
                                    <div class="tick right"></div>
                                </div>
                                <span class="pitch-text right"
                                    >{Math.abs(angle)}</span
                                >
                            </div>
                        {/each}
                    </div>
                </div>

                <div class="roll-scale">
                    <svg viewBox="0 0 200 200" width="100%" height="100%">
                        <path
                            d="M 20 100 A 80 80 0 0 1 180 100"
                            fill="none"
                            stroke="white"
                            stroke-width="2"
                        />
                        {#each [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60] as tick}
                            <line
                                x1="100"
                                y1="20"
                                x2="100"
                                y2={tick % 30 === 0 && tick !== 0 ? 30 : 25}
                                transform="rotate({tick} 100 100)"
                                stroke="white"
                                stroke-width="2"
                            />
                        {/each}
                        <polygon points="100,20 95,10 105,10" fill="white" />
                    </svg>
                </div>
            </div>

            <div class="fixed-roll-pointer">
                <svg viewBox="0 0 20 20" width="20" height="20">
                    <polygon points="10,20 0,0 20,0" fill="yellow" />
                </svg>
            </div>

            <div class="center-reticle">
                <div class="reticle-wing left"></div>
                <div class="reticle-center">
                    <div class="reticle-dot"></div>
                </div>
                <div class="reticle-wing right"></div>
            </div>
        </div>
    </div>
    <div class="digital-values">
        <div class="val-box"><span>ROLL</span> {roll.toFixed(1)}°</div>
        <div class="val-box"><span>PITCH</span> {pitch.toFixed(1)}°</div>
        <div class="val-box"><span>Ṙ</span> {rollRate.toFixed(1)}°/s</div>
        <div class="val-box"><span>Ṗ</span> {pitchRate.toFixed(1)}°/s</div>
    </div>
</div>

<style>
    .instrument-panel {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 15px;
        background-color: #111;
        padding: 20px 8px;
        border-radius: 12px;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
    }

    .instrument {
        width: 150px;
        height: 150px;
        border-radius: 50%;
        background-color: #222;
        border: 3px solid #444;
        box-shadow:
            0 4px 10px rgba(0, 0, 0, 0.5),
            inset 0 0 15px rgba(0, 0, 0, 0.8);
        position: relative;
        overflow: hidden;
    }

    .pfd-glass {
        width: 100%;
        height: 100%;
        position: relative;
        border-radius: 50%;
        overflow: hidden;
    }

    .pfd-roll-container {
        width: 100%;
        height: 100%;
        position: absolute;
        top: 0;
        left: 0;
        transition: transform 0.05s linear;
    }

    .pfd-pitch-container {
        width: 200%;
        height: 200%;
        position: absolute;
        top: -50%;
        left: -50%;
        transition: transform 0.05s linear;
    }

    .pfd-sky {
        width: 100%;
        height: 50%;
        background: linear-gradient(to bottom, #2b61af, #4c8ae6);
    }

    .pfd-ground {
        width: 100%;
        height: 50%;
        background: linear-gradient(to bottom, #6b4c2a, #4a341b);
    }

    .pfd-horizon-line {
        position: absolute;
        top: 50%;
        left: 0;
        width: 100%;
        height: 2px;
        background-color: white;
        transform: translateY(-50%);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
    }

    .pitch-ladder {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
    }

    .pitch-line-container {
        position: absolute;
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        transform: translateY(-50%);
    }

    .pitch-text {
        color: white;
        font-size: 10px;
        font-weight: bold;
        text-shadow: 1px 1px 1px black;
        width: 20px;
        text-align: center;
    }

    .pitch-text.left {
        margin-right: 5px;
        text-align: right;
    }

    .pitch-text.right {
        margin-left: 5px;
        text-align: left;
    }

    .pitch-line {
        display: flex;
        align-items: center;
        width: 80px;
    }

    .pitch-line .tick {
        height: 2px;
        background-color: white;
        flex-grow: 1;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
    }

    .pitch-line.negative .tick {
        background: repeating-linear-gradient(
            to right,
            white 0,
            white 4px,
            transparent 4px,
            transparent 8px
        );
    }

    .pitch-line .tick.left {
        border-right: 2px solid white;
        height: 6px;
    }

    .pitch-line .tick.right {
        border-left: 2px solid white;
        height: 6px;
    }

    .pitch-line.positive .tick.left {
        align-self: flex-end;
    }
    .pitch-line.positive .tick.right {
        align-self: flex-end;
    }
    .pitch-line.negative .tick.left {
        align-self: flex-start;
    }
    .pitch-line.negative .tick.right {
        align-self: flex-start;
    }

    .pitch-line .center-gap {
        width: 40px;
    }

    .roll-scale {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
    }

    .fixed-roll-pointer {
        position: absolute;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10;
    }

    .center-reticle {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        display: flex;
        align-items: center;
        z-index: 10;
    }

    .reticle-wing {
        width: 30px;
        height: 4px;
        background-color: yellow;
        box-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
        position: relative;
    }

    .reticle-wing.left::after {
        content: "";
        position: absolute;
        right: 0;
        bottom: -10px;
        width: 4px;
        height: 14px;
        background-color: yellow;
    }

    .reticle-wing.right::before {
        content: "";
        position: absolute;
        left: 0;
        bottom: -10px;
        width: 4px;
        height: 14px;
        background-color: yellow;
    }

    .reticle-center {
        width: 10px;
        height: 10px;
        margin: 0 10px;
        position: relative;
    }

    .reticle-dot {
        width: 6px;
        height: 6px;
        background-color: yellow;
        border-radius: 50%;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        box-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
    }

    .digital-values {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 2px;
        flex-wrap: wrap;
        justify-content: center;
    }

    .val-box {
        background-color: #000;
        border: 1px solid #333;
        padding: 4px;
        border-radius: 4px;
        color: #00ff00;
        font-family: "Courier New", Courier, monospace;
        font-weight: bold;
        font-size: 12px;
        display: flex;
        align-items: center;
        gap: 2px;
        min-width: 90px;
        justify-content: space-between;
    }

    .val-box span {
        color: #aaa;
        font-size: 10px;
    }
</style>
