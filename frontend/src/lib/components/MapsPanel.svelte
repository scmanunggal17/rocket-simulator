<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import * as maptilersdk from "@maptiler/sdk";
    import "@maptiler/sdk/dist/maptiler-sdk.css";
    import {
        rocketLat,
        rocketLon,
        currentAltitude,
    } from "../stores/flightStore";
    import { connected } from "../stores/telemetryStore";

    // ── Config ────────────────────────────────────────────────────────────────
    const MAPTILER_KEY = "aUOEn1bA48mz3xc3pL4N";

    // Default view when no GPS fix — set to your launch site
    const DEFAULT_LNG = 110.37;
    const DEFAULT_LAT = -7.8;
    const DEFAULT_ZOOM = 11;
    // ─────────────────────────────────────────────────────────────────────────

    let mapContainer: HTMLDivElement;
    // Typed as `any` to avoid conflict with the built-in TS `Map` global
    let map: any;
    let rocketMarker: any = null;
    let trailCoords: [number, number][] = [];
    const MAX_TRAIL = 500;

    maptilersdk.config.apiKey = MAPTILER_KEY;

    onMount(() => {
        map = new maptilersdk.Map({
            container: mapContainer,
            style: maptilersdk.MapStyle.HYBRID,
            center: [DEFAULT_LNG, DEFAULT_LAT],
            zoom: DEFAULT_ZOOM,
        });

        // map.addControl(new maptilersdk.NavigationControl(), "top-left");

        map.on("load", () => {
            // Trail line source + layer
            map.addSource("trail", {
                type: "geojson",
                data: {
                    type: "Feature",
                    geometry: { type: "LineString", coordinates: [] },
                    properties: {},
                },
            });
            map.addLayer({
                id: "trail-line",
                type: "line",
                source: "trail",
                paint: {
                    "line-color": "#38bdf8",
                    "line-width": 2,
                    "line-opacity": 0.8,
                },
            });
        });
    });

    onDestroy(() => {
        map?.remove();
    });

    // React to incoming GPS position
    $: if (map && $rocketLat !== null && $rocketLon !== null) {
        const lng = $rocketLon;
        const lat = $rocketLat;

        // Create or move marker
        if (!rocketMarker) {
            const el = document.createElement("div");
            el.className = "rocket-marker";
            rocketMarker = new (maptilersdk.Marker as any)({ element: el })
                .setLngLat([lng, lat])
                .addTo(map);
        } else {
            rocketMarker.setLngLat([lng, lat]);
        }

        // Update trail
        trailCoords.push([lng, lat]);
        if (trailCoords.length > MAX_TRAIL) trailCoords.shift();
        const src = map.getSource("trail") as any;
        if (src) {
            src.setData({
                type: "Feature",
                geometry: { type: "LineString", coordinates: trailCoords },
                properties: {},
            });
        }

        // Re-center smoothly on first fix
        if (trailCoords.length === 1) {
            map.flyTo({
                center: [lng, lat],
                zoom: DEFAULT_ZOOM,
                duration: 1000,
            });
        }
    }

    // Clear trail on disconnect
    $: if (!$connected) {
        trailCoords = [];
        if (rocketMarker) {
            rocketMarker.remove();
            rocketMarker = null;
        }
        if (map?.getSource("trail")) {
            const src = map.getSource("trail") as any;
            src?.setData({
                type: "Feature",
                geometry: { type: "LineString", coordinates: [] },
                properties: {},
            });
        }
    }
</script>

<div class="maps-wrap">
    <div bind:this={mapContainer} class="map-container"></div>

    <!-- HUD overlay -->
    <div class="map-hud">
        {#if $rocketLat !== null && $rocketLon !== null}
            <div class="hud-row">
                <span class="hud-label">LAT</span>
                <span class="hud-value">{$rocketLat.toFixed(6)}°</span>
            </div>
            <div class="hud-row">
                <span class="hud-label">LON</span>
                <span class="hud-value">{$rocketLon.toFixed(6)}°</span>
            </div>
            <div class="hud-row">
                <span class="hud-label">ALT</span>
                <span class="hud-value">{$currentAltitude.toFixed(0)} m</span>
            </div>
            <div class="hud-row">
                <span class="hud-label">TRK</span>
                <span class="hud-value">{trailCoords.length} pts</span>
            </div>
        {:else}
            <div class="hud-row no-fix">
                <span class="hud-label">GPS</span>
                <span class="hud-value warn">NO FIX</span>
            </div>
        {/if}
    </div>
</div>

<style>
    .maps-wrap {
        position: relative;
        width: 100%;
        height: 100%;
    }

    .map-container {
        width: 100%;
        height: 100%;
    }

    /* Rocket icon on the map */
    :global(.rocket-marker) {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #f97316;
        border: 2px solid #fff;
        box-shadow: 0 0 10px rgba(249, 115, 22, 0.8);
    }

    .map-hud {
        position: absolute;
        top: 12px;
        left: 12px;
        background: rgba(2, 6, 23, 0.82);
        border: 1px solid #334155;
        border-radius: 4px;
        padding: 8px 12px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        pointer-events: none;
        backdrop-filter: blur(4px);
    }

    .hud-row {
        display: flex;
        gap: 8px;
        align-items: baseline;
    }

    .hud-label {
        font-family: "Courier New", monospace;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 1px;
        color: #94a3b8;
        width: 28px;
    }

    .hud-value {
        font-family: "Courier New", monospace;
        font-size: 12px;
        font-weight: 700;
        color: #38bdf8;
        letter-spacing: 0.05em;
    }

    .hud-value.warn {
        color: #fbbf24;
    }
</style>
