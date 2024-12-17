<template>
  <div class="flex flex-col h-full gap-4 text-center text-sm py-4">
    <img src="/icons/app/logo-mainnet.svg?url" class="w-23 m-auto pt-2" />
    <div>
      <h1 v-once class="text-2xl m-auto">
        <span v-if="testnet">Nautilus Testnet Wallet</span>
        <span v-else>Nautilus Wallet</span>
      </h1>

      <p v-once>
        v{{ version }}, Commit:
        <a :href="commitUrl" target="_blank" class="url">{{ shortGitHash }}</a>
      </p>
    </div>
    <p class="italic text-gray-600 text-sm">
      Built-in secrecy, sourcing parts from unnamed sources. Roams the seas beyond the reach of
      land-based governments.
    </p>

    <div class="flex-grow"></div>

    <a
      class="m-auto url text-sm"
      target="_blank"
      href="https://github.com/nautls/nautilus-wallet/blob/master/privacy-policy.md"
      >Privacy Policy</a
    >

    <p class="text-sm">
      Support the development by donating to:
      <span v-if="readonly">
        {{ format.string.shorten(donationAddress, 20) }}
        <click-to-copy :content="donationAddress" :size="14" class="align-middle" />
      </span>
      <a v-else class="font-mono url cursor-pointer" @click="goDonate()">{{
        format.string.shorten(donationAddress, 20)
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
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import pkg from "../../package.json";
import { MAINNET } from "@/constants/ergo";
import { WalletType } from "@/types/internal";
import { useWalletStore } from "@/stores/walletStore";
import { useFormat } from "@/composables/useFormat";

export default defineComponent({
  name: "AboutView",
  setup() {
    return { wallet: useWalletStore(), format: useFormat() };
  },
  computed: {
    version(): string {
      return pkg.version;
    },
    gitHash(): string {
      return import.meta.env.GIT_COMMIT_HASH;
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
      return this.wallet.type === WalletType.ReadOnly;
    },
    testnet() {
      return !MAINNET;
    }
  },
  methods: {
    goDonate() {
      this.$router.push({ name: "send-page", query: { recipient: this.donationAddress } });
    }
  }
});
</script>
