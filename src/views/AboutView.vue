<template>
  <div class="flex flex-col h-full gap-4 text-center text-sm">
    <img src="/icons/app/logo.svg" class="w-23 m-auto pt-2" />
    <div>
      <h1 class="text-2xl m-auto">Nautilus Wallet</h1>

      <p v-once>
        v{{ version }}, Commit:
        <a :href="commitUrl" target="_blank" class="url">{{ shortGitHash }}</a>
      </p>
    </div>
    <p class="italic text-gray-600 text-base">
      Built-in secrecy, sourcing parts from unnamed sources. Roams the seas beyond the reach of
      land-based governments.
    </p>

    <div class="flex-grow"></div>

    <p class="text-sm">
      Support the development by donating to:
      <span v-if="readonly">
        {{ $filters.compactString(donationAddress, 20) }}
        <click-to-copy :content="donationAddress" size="14" class="align-middle" />
      </span>
      <a v-else class="font-mono url cursor-pointer" @click="goDonate()">{{
        $filters.compactString(donationAddress, 20)
      }}</a>
    </p>

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

    <p class="text-sm text-gray-500">
      Pricing rates powered by
      <a class="url" target="_blank" href="https://www.coingecko.com/en/api">CoinGecko API</a>
    </p>
  </div>
</template>

<script lang="ts">
import { WalletType } from "@/types/internal";
import { defineComponent } from "vue";
const { version } = require("../../package.json");

export default defineComponent({
  name: "AboutView",
  computed: {
    version(): string {
      return version;
    },
    gitHash(): string {
      return process.env.GIT_HASH;
    },
    shortGitHash(): string {
      return this.gitHash?.slice(0, 7) ?? "";
    },
    commitUrl(): string {
      return `https://github.com/capt-nemo429/nautilus-wallet/commit/${this.gitHash}`;
    },
    donationAddress(): string {
      return "9iPgSVU3yrRnTxtJC6hYA7bS5mMqZtjeJHrT3fNdLV7JZVpY5By";
    },
    readonly(): boolean {
      return this.$store.state.currentWallet.type === WalletType.ReadOnly;
    }
  },
  methods: {
    goDonate() {
      this.$router.push({ name: "send-page", query: { recipient: this.donationAddress } });
    }
  }
});
</script>
