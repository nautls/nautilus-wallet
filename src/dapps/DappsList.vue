<script setup lang="ts">
import { dappsManifest } from "@/dapps/dappsManifest";
</script>

<template>
  <div class="items-top flex flex-wrap justify-start">
    <router-link
      v-for="dapp in dappsManifest"
      :key="dapp.path"
      v-slot="{ navigate }"
      :to="dapp.path"
      custom
    >
      <div class="w-1/2 p-2 text-center">
        <button
          class="m-auto w-full cursor-pointer rounded border border-gray-200 bg-white py-4 transition duration-200 hover:bg-gray-100 active:bg-gray-200"
          @click="navigate"
        >
          <img :src="`/icons/dapps/${dapp.icon}`" class="m-auto h-16 w-16" />
          <p class="px-2 pt-2 text-xs leading-tight">
            {{ dapp.name }}
          </p>
        </button>
      </div>
    </router-link>
  </div>
</template>
