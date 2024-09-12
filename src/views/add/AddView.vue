<script setup lang="ts">
import { computed } from "vue";
import LedgerLogo from "@/assets/images/hw-devices/ledger-logo.svg";
import { useWalletStore } from "@/stores/walletStore";
import { browser, isPopup } from "@/common/browser";
import { EXT_ENTRY_ROOT } from "@/constants/extension";

const wallet = useWalletStore();

const hasWallets = computed(() => wallet.id !== 0);

function navigateInTab(navigate: () => unknown, href: string) {
  if (!isPopup() || !browser || !browser.tabs) return navigate();

  const url = browser.runtime.getURL(`${EXT_ENTRY_ROOT}/popup/index.html${href}?redirect=false`);
  browser.tabs.create({ url, active: true });
  window.close();
}
</script>

<template>
  <div class="flex flex-col gap-4 h-full py-4">
    <div class="flex-grow"></div>
    <router-link v-slot="{ navigate }" to="/add/new" custom>
      <button type="button" class="nav-btn" @click="navigate">
        <div class="h-full float-left flex w-8 mr-4">
          <mdi-icon name="wallet-plus" size="32" class="m-auto text-gray-500" />
        </div>
        <span class="title">Create wallet</span>
        <span class="subtitle"
          >Generate a 15-word recovery phrase and create a new Ergo wallet.</span
        >
      </button>
    </router-link>
    <router-link v-slot="{ navigate }" to="/add/restore" custom>
      <button type="button" class="nav-btn" @click="navigate">
        <div class="h-full float-left flex w-8 mr-4">
          <mdi-icon name="backup-restore" size="32" class="m-auto text-gray-500" />
        </div>
        <span class="title">Restore wallet</span>
        <span class="subtitle"
          >Enter a recovery phrase to restore an already-existing Ergo wallet.</span
        >
      </button>
    </router-link>
    <router-link v-slot="{ navigate, href }" to="/add/hw/ledger" custom>
      <button
        type="button"
        class="nav-btn"
        @click="navigateInTab(navigate, href)"
        @keypress.enter="navigateInTab(navigate, href)"
      >
        <div class="h-full float-left flex w-8 mr-4">
          <ledger-logo class="w-6 h-6 m-auto fill-gray-600" />
        </div>
        <span class="title">Connect a hardware wallet</span>
        <span class="subtitle"
          >Create or restore an Ergo wallet using a Ledger hardware wallet.</span
        >
      </button>
    </router-link>
    <router-link v-slot="{ navigate }" to="/add/read-only" custom>
      <button role="button" type="button" class="nav-btn" @click="navigate">
        <div class="h-full float-left flex w-8 mr-4">
          <mdi-icon name="wallet-outline" size="32" class="m-auto text-gray-500" />
        </div>
        <span class="title">Load read-only wallet</span>
        <span class="subtitle">Enter a public key to load an Ergo wallet in read-only mode.</span>
      </button>
    </router-link>
    <div class="flex-grow"></div>
    <button v-if="hasWallets" class="btn outlined w-full" @click="$router.back()">Cancel</button>
  </div>
</template>
