<template>
  <div class="text-center" :class="rootClass" v-once>
    <div class="min-h-max" :class="testnet ? '-mb-4' : ''">
      <img
        src="/icons/app/logo-testnet.svg"
        v-if="testnet"
        class="inline-block min-w-max"
        :class="contentClass"
      />
      <img
        src="/icons/app/logo-mainnet.svg"
        v-else
        class="inline-block min-w-max"
        :class="contentClass"
      />
    </div>

    <span
      v-if="testnet"
      class="bg-yellow-300 text-gray-700 text-xs rounded px-1 py-0 uppercase select-none"
    >
      testnet
    </span>
  </div>
</template>

<script lang="ts">
import { MAINNET } from "@/constants/ergo";
import { defineComponent } from "vue";

export default defineComponent({
  name: "WalletLogo",
  props: {
    rootClass: { type: String },
    contentClass: { type: String }
  },
  computed: {
    testnet() {
      return !MAINNET;
    }
  }
});
</script>
