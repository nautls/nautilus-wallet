<script setup lang="ts">
import { computed, onMounted, shallowRef } from "vue";
import WalletLogo from "./WalletLogo.vue";
import store from "@/store";
import { browser } from "@/common/browser";
import { EXT_ENTRY_ROOT } from "@/constants/extension";
import { IDbWallet, NotNullId } from "@/types/database";
import { walletsDbService } from "@/database/walletsDbService";
import { useWalletStore } from "@/stores/walletStore";

const wallet = useWalletStore();

const wallets = shallowRef<NotNullId<IDbWallet>[]>([]);

const loading = computed(() => store.state.loading);

const unselected = computed(() => {
  if (!wallets.value) return [];
  const currentId = wallet.id;
  return wallets.value.filter((w) => w.id !== currentId);
});

const current = computed(() => {
  return wallets.value.find((w) => w.id === wallet.id);
});

onMounted(async () => {
  wallets.value = await walletsDbService.getAll();
});

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
            v-if="current"
            :key="wallet.id"
            :wallet="current"
            :reverse="!active"
            :loading="loading.addresses || loading.balance"
          />
        </template>
        <template #items>
          <div class="group">
            <a
              v-for="walletItem in unselected"
              :key="walletItem.id"
              class="group-item"
              @click="wallet.load(walletItem.id)"
            >
              <wallet-item :key="wallet.id" :wallet="walletItem" />
            </a>
          </div>
          <div class="group">
            <router-link :to="{ name: 'add-wallet' }" class="group-item narrow-y">
              <vue-feather type="plus-circle" size="16" class="align-middle pr-2" />
              <span class="align-middle">Add new wallet</span></router-link
            >
          </div>
          <div class="group" :class="{ 'mt-1': unselected.length === 0 }">
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
