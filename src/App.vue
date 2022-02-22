<template>
  <div class="app">
    <div
      v-if="$route.meta.fullPage || $route.query.auth === 'true'"
      class="flex flex-row p-4 gap-3 items-center bg-gray-100"
    >
      <img src="@/assets/images/logo.png" class="w-10" />
      <h1 class="text-xl font-500">Nautilus Wallet</h1>
    </div>
    <template v-else>
      <wallet-header v-show="!$route.meta.fullPage && $route.query.auth !== 'true'" />
      <nav-header v-if="!$route.meta.fullPage && $route.query.popup !== 'true'" />
    </template>
    <div class="flex-grow overflow-y-auto overflow-x-hidden p-4">
      <router-view />
    </div>
    <kya-modal :active="!loading.settings && !settings.isKyaAccepted" />
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import NavHeader from "@/components/NavHeader.vue";
import WalletHeader from "@/components/WalletHeader.vue";
import { PRICE_FETCH_INTERVAL, REFRESH_BALANCE_INTERVAL } from "./constants/intervals";
import { mapActions, mapState } from "vuex";
import { ACTIONS } from "./constants/store/actions";
import KyaModal from "./components/KYAModal.vue";

function runSetInterval(callback: () => void, ms: number): NodeJS.Timer {
  callback();
  return setInterval(callback, ms);
}

export default defineComponent({
  name: "App",
  components: {
    NavHeader,
    WalletHeader,
    KyaModal
  },
  data: () => {
    return {
      getPriceTimerId: Object.freeze({} as NodeJS.Timer),
      syncTimerId: Object.freeze({} as NodeJS.Timer)
    };
  },
  async created() {
    this.syncTimerId = Object.freeze(
      setInterval(() => {
        this.refresh();
      }, REFRESH_BALANCE_INTERVAL)
    );

    await this.init();
    this.getPriceTimerId = Object.freeze(
      runSetInterval(() => {
        this.fetchPrices();
      }, PRICE_FETCH_INTERVAL)
    );
  },
  deactivated() {
    clearInterval(this.getPriceTimerId);
    clearInterval(this.syncTimerId);
  },
  computed: mapState(["loading", "settings"]),
  methods: {
    ...mapActions({
      fetchPrices: ACTIONS.FETCH_CURRENT_PRICES,
      init: ACTIONS.INIT,
      refresh: ACTIONS.REFRESH_CURRENT_ADDRESSES
    })
  }
});
</script>
