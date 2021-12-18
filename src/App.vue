<template>
  <div class="flex flex-col h-full h-600px max-h-600px w-400px gap-0">
    <wallet-header v-show="!$route.meta.fullPage" />
    <nav-header v-if="!$route.meta.fullPage" />
    <div class="flex-grow overflow-y-auto overflow-x-hidden">
      <div class="p-4">
        <router-view />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import NavHeader from "@/components/NavHeader.vue";
import WalletHeader from "@/components/WalletHeader.vue";

import { PRICE_FETCH_INTERVAL } from "./constants/price";
import { mapActions } from "vuex";
import { ACTIONS } from "./constants/store/actions";

function runSetInterval(callback: () => void, ms: number): NodeJS.Timer {
  callback();
  return setInterval(callback, ms);
}

export default defineComponent({
  name: "App",
  data: () => {
    return { getPriceTimerId: Object.freeze({} as NodeJS.Timer) };
  },
  created() {
    this.init();

    this.getPriceTimerId = Object.freeze(
      runSetInterval(() => {
        this.fetchPrices();
      }, PRICE_FETCH_INTERVAL)
    );
  },
  deactivated() {
    clearInterval(this.getPriceTimerId);
  },
  methods: {
    ...mapActions({
      fetchPrices: ACTIONS.FETCH_CURRENT_PRICES,
      init: ACTIONS.INIT
    })
  },
  components: {
    NavHeader,
    WalletHeader
  }
});
</script>
