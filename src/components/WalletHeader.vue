<script setup lang="ts">
import { WalletSwitcher } from "@/components/wallet";
import NautilusLogo from "./NautilusLogo.vue";
</script>

<template>
  <div class="flex flex-row items-center gap-8 bg-header px-4 py-3 pb-0 justify-between">
    <WalletSwitcher />
    <NautilusLogo class="mx-4 size-10 my-2" />
  </div>
</template>
