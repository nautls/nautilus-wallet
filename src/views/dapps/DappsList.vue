<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { dappsManifest } from "@/dapps/dappsManifest";
</script>

<template>
  <div class="grid grid-cols-2 justify-stretch gap-4 p-4 sm:grid-cols-4 md:grid-cols-2">
    <router-link
      v-for="dapp in dappsManifest"
      :key="dapp.path"
      v-slot="{ navigate }"
      :to="dapp.path"
      custom
    >
      <Button
        variant="outline"
        class="h-full w-full flex-col gap-4 p-4 [&_img]:size-14 [&_svg]:size-14"
        @click="navigate"
      >
        <component :is="dapp.icon.component" class="m-auto" v-bind="dapp.icon.props" />
        <span class="text-xs"> {{ dapp.name }} </span>
      </Button>
    </router-link>
  </div>
</template>
