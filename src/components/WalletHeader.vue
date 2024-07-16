<script setup lang="ts">
import { computed, onMounted, shallowRef } from "vue";
import WalletLogo from "./WalletLogo.vue";
import store from "@/store";
import { browser } from "@/common/browser";
import { EXT_ENTRY_ROOT } from "@/constants/extension";
import { ACTIONS } from "@/constants/store";
import { IDbWallet } from "@/types/database";
import { walletsDbService } from "@/database/walletsDbService";

const wallets = shallowRef<IDbWallet[]>([]);

const loading = computed(() => store.state.loading);

const currentWallet = computed(() => {
  if (!store.state.currentWallet || !wallets.value) return;
  return wallets.value?.find((w) => w.id === store.state.currentWallet?.id);
});

const unselectedWallets = computed(() => {
  if (!wallets.value) return [];
  const currentId = store.state.currentWallet?.id;
  return wallets.value.filter((w) => w.id !== currentId);
});

onMounted(async () => {
  wallets.value = await walletsDbService.getAll();
});

function setCurrentWallet(wallet: IDbWallet) {
  store.dispatch(ACTIONS.SET_CURRENT_WALLET, wallet.id);
}

async function expandView() {
  if (!browser?.tabs) return;

  browser.tabs.create({
    url: browser.runtime.getURL(`${EXT_ENTRY_ROOT}/popup/index.html`),
    active: true
  });
  window.close();
}
</script>

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
            v-if="currentWallet"
            :key="currentWallet.id"
            :wallet="currentWallet"
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
              <wallet-item :key="currentWallet?.id" :wallet="unselected" />
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
            <router-link :to="{ name: 'connector-connected' }" class="group-item narrow-y">
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
