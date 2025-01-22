<script setup lang="ts">
import WalletLogo from "./WalletLogo.vue";
import WalletSwitcher from "./WalletSwitcher.vue";
</script>

<template>
  <div class="flex flex-row items-center gap-8 bg-header px-4 py-3 pb-0 justify-between">
    <wallet-switcher />
    <wallet-logo class="mx-4 size-10 my-2" />
  </div>
</template>
