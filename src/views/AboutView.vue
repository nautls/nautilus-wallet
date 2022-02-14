<template>
  <div class="flex flex-col h-full gap-4 text-center">
    <img src="@/assets/images/logo-big.png" alt="Nautilus" class="w-30 m-auto" />
    <div>
      <h1 class="text-2xl m-auto">Nautilus Wallet</h1>
      <p class="text-sm text-gray-500">v{{ version }}</p>
    </div>
    <p class="italic text-gray-600">
      Built-in secrecy, sourcing parts from unnamed sources. Roams the seas beyond the reach of
      land-based governments.
    </p>

    <div class="flex-grow"></div>
    <div class="flex flex-row mx-20 gap-1 items-center">
      <a class="m-auto" target="_blank" href="https://github.com/capt-nemo429/nautilus-wallet"
        ><vue-feather type="github" class="m-auto"
      /></a>
      <a class="m-auto" target="_blank" href="https://twitter.com/NautilusWallet"
        ><vue-feather type="twitter" class="m-auto"
      /></a>
      <a class="m-auto" target="_blank" href="https://t.me/nautiluswallet"
        ><vue-feather type="send" class="m-auto"
      /></a>
    </div>
    <p class="text-sm">
      Pricing rates powered by
      <a class="url" target="_blank" href="https://www.coingecko.com/en/api">CoinGecko API</a>
    </p>
    <p class="text-sm text-gray-500" v-once>
      Copyright © {{ new Date().getFullYear() }} Nautilus Team
    </p>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
const { version } = require("../../package.json");

export default defineComponent({
  name: "AboutView",
  computed: {
    version(): string {
      return version;
    }
  }
});
</script>
