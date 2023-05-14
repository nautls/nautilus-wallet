<template>
  <div class="flex flex-col gap-4 pt-2">
    <div class="flex flex-wrap items-top justify-start">
      <div class="w-1/2 text-center p-2" v-for="dapp in dapps" :key="dapp.path">
        <button
          class="cursor-pointer border border-gray-200 rounded w-full m-auto py-4 bg-white transition duration-250 hover:bg-gray-100 active:bg-gray-200"
        >
          <mdi-icon :name="dapp.icon.name" size="64" :class="dapp.icon.color || 'text-gray-500'" />
          <p class="text-xs leading-tight pt-2 px-2">
            {{ dapp.name }}
          </p>
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { dappsManifest } from "@/dapps/dappsManifest";

export default defineComponent({
  name: "DappsView",
  computed: {
    dapps() {
      return dappsManifest;
    }
  }
});
</script>
