<script lang="ts">
    import AttitudeIndicator from "./AttitudeIndicator.svelte";
    import CompassIndicator from "./CompassIndicator.svelte";
    import SensorCard from "./SensorCard.svelte";
    import {
        roll,
        pitch,
        yaw,
        rollRate,
        pitchRate,
        yawRate,
        accX,
        accY,
        accZ,
        gyroX,
        gyroY,
        gyroZ,
        magX,
        magY,
        magZ,
    } from "../stores/imuStore";
</script>

<div class="imu-panel">
    <div class="section-label">ATTITUDE</div>
    <div class="instruments-row">
        <AttitudeIndicator
            roll={$roll}
            pitch={$pitch}
            rollRate={$rollRate}
            pitchRate={$pitchRate}
        />
        <CompassIndicator yaw={$yaw} yawRate={$yawRate} />
    </div>

    <div class="section-label">RAW SENSORS · SCALED_IMU</div>
    <div class="sensor-cards">
        <SensorCard
            title="ACCELEROMETER"
            unit="m/s²"
            x={$accX}
            y={$accY}
            z={$accZ}
            maxAbs={20}
            warnAt={10}
            critAt={15}
            decimals={2}
        />
        <SensorCard
            title="GYROSCOPE"
            unit="deg/s"
            x={$gyroX}
            y={$gyroY}
            z={$gyroZ}
            maxAbs={180}
            warnAt={45}
            critAt={90}
            decimals={1}
        />
        <SensorCard
            title="MAGNETOMETER"
            unit="mGauss"
            x={$magX}
            y={$magY}
            z={$magZ}
            maxAbs={600}
            decimals={0}
        />
    </div>
</div>

<style>
    .imu-panel {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 12px;
        width: 100%;
        box-sizing: border-box;
        font-family: "Courier New", Courier, monospace;
    }

    .section-label {
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 2px;
        color: #334155;
        text-transform: uppercase;
        padding: 0 2px;
        border-bottom: 1px solid #1e293b;
        padding-bottom: 4px;
    }

    .instruments-row {
        display: flex;
        gap: 10px;
        justify-content: center;
        flex-wrap: wrap;
    }

    .sensor-cards {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
</style>
