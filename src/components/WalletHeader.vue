<template>
  <div class="flex flex-row px-4 py-2 gap-4 items-center bg-gray-100">
    <div class="flex-grow">
      <img src="@/assets/images/logo.png" class="w-14 ml-2" />
    </div>
    <div class="w-min">
      <drop-down discrete :disabled="$route.query.popup === 'true'">
        <template v-slot:trigger>
          <wallet-item
            :wallet="wallet"
            :loading="loading.addresses || loading.balance"
            :key="wallet.id"
          />
        </template>
        <template v-slot:items>
          <div class="group" v-if="unselectedWallets.length > 0">
            <a
              v-for="unselected in unselectedWallets"
              @click="setCurrentWallet(unselected)"
              :key="unselected.id"
              class="group-item"
            >
              <wallet-item :wallet="unselected" :key="wallet.id" />
            </a>
          </div>
          <div class="group" :class="{ 'mt-1': unselectedWallets.length === 0 }">
            <router-link :to="{ name: 'add-wallet' }" class="group-item narrow">
              <vue-feather type="plus-circle" size="16" class="align-middle pr-2" />
              <span class="align-middle">Add new wallet</span></router-link
            >
            <a @click="expandView()" class="group-item narrow">
              <vue-feather type="maximize-2" size="16" class="align-middle pr-2" />
              <span class="align-middle">Expand view</span></a
            >
            <router-link
              v-if="connections.length > 0"
              :to="{ name: 'connector-connected' }"
              class="group-item narrow"
            >
              <vue-feather type="list" size="16" class="align-middle pr-2" />
              <span class="align-middle">Connected dApps</span></router-link
            >
            <router-link :to="{ name: 'wallet-settings' }" class="group-item narrow">
              <vue-feather type="settings" size="16" class="align-middle pr-2" />
              <span class="align-middle">Settings</span></router-link
            >
            <router-link :to="{ name: 'about-nautilus' }" class="group-item narrow">
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
import NavHeader from "@/components/NavHeader.vue";
import { StateWallet } from "@/types/internal";
import { ACTIONS } from "@/constants/store";

export default defineComponent({
  name: "WalletHeader",
  components: { NavHeader },
  data() {
    return {
      checksum: ""
    };
  },
  methods: {
    ...mapActions({ setCurrentWallet: ACTIONS.SET_CURRENT_WALLET }),
    async expandView() {
      if (!chrome.tabs) {
        return;
      }

      chrome.tabs.create({
        url: chrome.extension.getURL("index.html"),
        active: true
      });
      window.close();
    }
  },
  computed: {
    ...mapState({
      wallet: "currentWallet",
      loading: "loading",
      connections: "connections"
    }),
    unselectedWallets() {
      const currentId = this.$store.state.currentWallet?.id;
      return this.$store.state.wallets.filter((w: StateWallet) => w.id !== currentId);
    }
  }
});
</script>
