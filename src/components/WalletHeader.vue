<script setup lang="ts">
import { computed } from "vue";
import { InfoIcon, ListIcon, Maximize2Icon, PlusCircleIcon, SettingsIcon } from "lucide-vue-next";
import WalletLogo from "./WalletLogo.vue";
import DropDown from "./DropDown.vue";
import WalletItem from "@/components/WalletItem.vue";
import { browser } from "@/common/browser";
import { EXT_ENTRY_ROOT } from "@/constants/extension";
import { useWalletStore } from "@/stores/walletStore";
import { useAppStore } from "@/stores/appStore";

const wallet = useWalletStore();
const app = useAppStore();

const unselected = computed(() => {
  if (!app.wallets) return [];
  return app.wallets.filter((w) => w.id !== wallet.id);
});

const current = computed(() => app.wallets.find((w) => w.id === wallet.id));

async function expandView() {
  if (!browser?.tabs) return;

  const url = browser.runtime.getURL(`${EXT_ENTRY_ROOT}/popup/index.html`);
  browser.tabs.create({ url, active: true });
  window.close();
}
</script>

<template>
  <div class="flex flex-row items-center gap-0 bg-foreground/5 px-4 py-4">
    <wallet-logo class="ml-2" content-class="w-11 h-11" />
    <div class="flex-grow"></div>
    <div class="w-min">
      <drop-down discrete list-class="max-h-110">
        <template #trigger="{ active }">
          <wallet-item
            v-if="current"
            :key="wallet.id"
            :wallet="current"
            :reverse="!active"
            :loading="wallet.loading || wallet.syncing"
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
              <plus-circle-icon class="inline pr-2" />
              <span class="align-middle">Add new wallet</span></router-link
            >
          </div>
          <div class="group" :class="{ 'mt-1': unselected.length === 0 }">
            <a class="group-item narrow-y" @click="expandView()">
              <maximize-2-icon class="inline pr-2" />
              <span class="align-middle">Expand view</span></a
            >
            <router-link :to="{ name: 'connector-connected' }" class="group-item narrow-y">
              <list-icon class="inline pr-2" />
              <span class="align-middle">Connected dApps</span></router-link
            >
            <router-link :to="{ name: 'wallet-settings' }" class="group-item narrow-y">
              <settings-icon class="inline pr-2" />
              <span class="align-middle">Settings</span></router-link
            >
          </div>
          <div class="group">
            <router-link :to="{ name: 'about-nautilus' }" class="group-item narrow-y">
              <info-icon class="inline pr-2" />
              <span class="align-middle">About</span></router-link
            >
          </div>
        </template>
      </drop-down>
    </div>
  </div>
</template>
