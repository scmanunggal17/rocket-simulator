<script lang="ts">
    import ImuPanel from "./ImuPanel.svelte";
</script>

<div class="side-menu">
    <ImuPanel />
</div>

<style>
    .side-menu {
        height: 100%;
        width: 100%;
        overflow-y: auto;
        overflow-x: hidden;
        box-sizing: border-box;
        scrollbar-width: thin;
        scrollbar-color: #334155 transparent;
    }

    .side-menu::-webkit-scrollbar {
        width: 5px;
    }

    .side-menu::-webkit-scrollbar-track {
        background: transparent;
    }

    .side-menu::-webkit-scrollbar-thumb {
        background: #334155;
        border-radius: 3px;
    }
</style>
