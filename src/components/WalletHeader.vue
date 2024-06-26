<template>
  <div
    class="flex flex-row px-4 py-2 gap-0 items-center bg-gray-100"
    :class="$route.query.popup === 'true' ? 'border-b-1 border-gray-200' : ''"
  >
    <wallet-logo class="ml-2" content-class="w-11 h-11" />
    <div class="flex-grow"></div>
    <div class="w-min">
      <drop-down discrete :disabled="$route.query.popup === 'true'" list-class="max-h-110">
        <template #trigger="{ active }">
          <wallet-item
            :key="wallet.id"
            :wallet="wallet"
            :reverse="!active"
            :loading="loading.addresses || loading.balance"
          />
        </template>
        <template #items>
          <div class="group">
            <a
              v-for="unselected in unselectedWallets"
              :key="unselected.id"
              class="group-item"
              @click="setCurrentWallet(unselected)"
            >
              <wallet-item :key="wallet.id" :wallet="unselected" />
            </a>
          </div>
          <div class="group">
            <router-link :to="{ name: 'add-wallet' }" class="group-item narrow-y">
              <vue-feather type="plus-circle" size="16" class="align-middle pr-2" />
              <span class="align-middle">Add new wallet</span></router-link
            >
          </div>
          <div class="group" :class="{ 'mt-1': unselectedWallets.length === 0 }">
            <a class="group-item narrow-y" @click="expandView()">
              <vue-feather type="maximize-2" size="16" class="align-middle pr-2" />
              <span class="align-middle">Expand view</span></a
            >
            <router-link
              v-if="connections.length > 0"
              :to="{ name: 'connector-connected' }"
              class="group-item narrow-y"
            >
              <vue-feather type="list" size="16" class="align-middle pr-2" />
              <span class="align-middle">Connected dApps</span></router-link
            >
            <router-link :to="{ name: 'wallet-settings' }" class="group-item narrow-y">
              <vue-feather type="settings" size="16" class="align-middle pr-2" />
              <span class="align-middle">Settings</span></router-link
            >
          </div>
          <div class="group">
            <router-link :to="{ name: 'about-nautilus' }" class="group-item narrow-y">
              <vue-feather type="info" size="16" class="align-middle pr-2" />
              <span class="align-middle">About</span></router-link
            >
          </div>
        </template>
      </drop-down>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { mapActions, mapState } from "vuex";
import WalletLogo from "./WalletLogo.vue";
import { StateWallet } from "@/types/internal";
import { ACTIONS } from "@/constants/store";
import { browser } from "@/common/browser";

export default defineComponent({
  name: "WalletHeader",
  components: { WalletLogo },
  data() {
    return {
      checksum: ""
    };
  },
  computed: {
    ...mapState({
      wallet: "currentWallet",
      loading: "loading",
      connections: "connections",
      wallets: "wallets"
    }),
    unselectedWallets(): StateWallet[] {
      const currentId = this.wallet?.id;
      return this.wallets.filter((w: StateWallet) => w.id !== currentId);
    }
  },
  methods: {
    ...mapActions({ setCurrentWallet: ACTIONS.SET_CURRENT_WALLET }),
    async expandView() {
      if (!browser?.tabs) return;

      browser.tabs.create({
        url: browser.runtime.getURL("index.html"),
        active: true
      });
      window.close();
    }
  }
});
</script>
