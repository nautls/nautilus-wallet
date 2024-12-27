<script setup lang="ts">
import WalletLogo from "./WalletLogo.vue";
import WalletSwitcher from "./WalletSwitcher.vue";
</script>

<template>
  <div class="flex flex-row items-center gap-0 bg-header p-4 justify-between">
    <wallet-switcher />
    <wallet-logo class="mx-4 w-11 h-11" />
  </div>
</template>
