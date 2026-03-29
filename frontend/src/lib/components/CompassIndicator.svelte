<script lang="ts">
    export let yaw: number = 0; // deg 0–360
    export let yawRate: number = 0; // deg/s
</script>

<div class="instrument-panel">
    <div class="instrument hsi">
        <div class="hsi-glass">
            <div class="compass-card" style="transform: rotate({-yaw}deg)">
                <svg viewBox="0 0 200 200" width="100%" height="100%">
                    {#each Array(72) as _, i}
                        {@const deg = i * 5}
                        <line
                            x1="100"
                            y1="5"
                            x2="100"
                            y2={deg % 30 === 0 ? 15 : deg % 15 === 0 ? 12 : 8}
                            transform="rotate({deg} 100 100)"
                            stroke="white"
                            stroke-width={deg % 30 === 0 ? 2 : 1}
                        />
                        {#if deg % 30 === 0}
                            <text
                                x="100"
                                y="28"
                                fill="white"
                                font-size="12"
                                font-family="sans-serif"
                                text-anchor="middle"
                                font-weight="bold"
                                transform="rotate({deg} 100 100)"
                            >
                                {deg === 0
                                    ? "N"
                                    : deg === 90
                                      ? "E"
                                      : deg === 180
                                        ? "S"
                                        : deg === 270
                                          ? "W"
                                          : (deg / 10).toString()}
                            </text>
                        {/if}
                    {/each}
                </svg>
            </div>

            <div class="hsi-aircraft">
                <svg viewBox="0 0 40 40" width="40" height="40">
                    <path
                        d="M20 5 L23 15 L35 18 L35 22 L23 23 L20 35 L17 23 L5 22 L5 18 L17 15 Z"
                        fill="rgba(255, 255, 255, 0.8)"
                        stroke="#333"
                        stroke-width="1"
                    />
                </svg>
            </div>

            <div class="heading-pointer">
                <svg viewBox="0 0 20 20" width="20" height="20">
                    <polygon points="10,0 20,15 10,10 0,15" fill="#ff4757" />
                </svg>
            </div>
        </div>
    </div>
    <div class="digital-values">
        <div class="val-box"><span>HDG</span> {yaw.toFixed(1)}°</div>
        <div class="val-box"><span>YAW R</span> {yawRate.toFixed(1)}°/s</div>
    </div>
</div>

<style>
    .instrument-panel {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 15px;
        background-color: #111;
        padding: 20px 10px;
        border-radius: 12px;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
    }

    .instrument {
        width: 140px;
        height: 140px;
        border-radius: 50%;
        background-color: #222;
        border: 3px solid #444;
        box-shadow:
            0 4px 10px rgba(0, 0, 0, 0.5),
            inset 0 0 15px rgba(0, 0, 0, 0.8);
        position: relative;
        overflow: hidden;
    }

    .hsi-glass {
        width: 100%;
        height: 100%;
        position: relative;
        border-radius: 50%;
        overflow: hidden;
    }

    .compass-card {
        width: 100%;
        height: 100%;
        position: absolute;
        top: 0;
        left: 0;
        background-color: #1a1a1a;
        transition: transform 0.05s linear;
    }

    .hsi-aircraft {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 5;
    }

    .heading-pointer {
        position: absolute;
        top: 5px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10;
        filter: drop-shadow(0px 2px 2px rgba(0, 0, 0, 0.5));
    }

    .digital-values {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        justify-content: center;
    }

    .val-box {
        background-color: #000;
        border: 1px solid #333;
        padding: 4px 10px;
        border-radius: 4px;
        color: #00ff00;
        font-family: "Courier New", Courier, monospace;
        font-weight: bold;
        font-size: 12px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        min-width: 80px;
        justify-content: space-between;
    }

    .val-box span {
        color: #aaa;
        font-size: 10px;
    }
</style>
