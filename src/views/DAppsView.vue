<template>
  <div class="flex flex-col gap-4 pt-2">
    <div class="flex flex-wrap gap-4 items-top justify-start">
      <div class="cursor-pointer w-25 text-center" v-for="dapp in dapps" :key="dapp.path">
        <p class="border border-gray-200 rounded w-full m-auto py-4 bg-white">
          <mdi-icon :name="dapp.icon.name" size="64" :class="dapp.icon.color || 'text-gray-500'" />
        </p>
        <p class="text-xs p-1">
          {{ dapp.name }}
        </p>
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
