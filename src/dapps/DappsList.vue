<script setup lang="ts">
import { dappsManifest } from "@/dapps/dappsManifest";
</script>

<template>
  <div class="flex flex-wrap items-top justify-start">
    <router-link
      v-for="dapp in dappsManifest"
      :key="dapp.path"
      :to="dapp.path"
      custom
      v-slot="{ navigate }"
    >
      <div class="w-1/2 text-center p-2">
        <button
          class="cursor-pointer border border-gray-200 rounded w-full m-auto py-4 bg-white transition duration-250 hover:bg-gray-100 active:bg-gray-200"
          @click="navigate"
        >
          <mdi-icon :name="dapp.icon.name" size="64" :class="dapp.icon.color || 'text-gray-500'" />
          <p class="text-xs leading-tight pt-2 px-2">
            {{ dapp.name }}
          </p>
        </button>
      </div>
    </router-link>
  </div>
</template>
