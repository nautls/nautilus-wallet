<script setup lang="ts">
import { computed } from "vue";
import { RotateCcwIcon, WalletIcon, WalletMinimalIcon } from "lucide-vue-next";
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
  <div class="flex h-full flex-col gap-4 py-4">
    <div class="flex-grow"></div>
    <router-link v-slot="{ navigate }" to="/add/new" custom>
      <button type="button" class="nav-btn" @click="navigate">
        <div class="float-left mr-4 flex h-full w-8">
          <wallet-icon class="m-auto text-gray-500" :size="32" />
        </div>
        <span class="title">Create wallet</span>
        <span class="subtitle"
          >Generate a 15-word recovery phrase and create a new Ergo wallet.</span
        >
      </button>
    </router-link>
    <router-link v-slot="{ navigate }" to="/add/restore" custom>
      <button type="button" class="nav-btn" @click="navigate">
        <div class="float-left mr-4 flex h-full w-8">
          <rotate-ccw-icon class="m-auto text-gray-500" :size="32" />
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
        <div class="float-left mr-4 flex h-full w-8">
          <ledger-logo class="m-auto h-6 w-6 fill-gray-600" />
        </div>
        <span class="title">Connect a hardware wallet</span>
        <span class="subtitle"
          >Create or restore an Ergo wallet using a Ledger hardware wallet.</span
        >
      </button>
    </router-link>
    <router-link v-slot="{ navigate }" to="/add/read-only" custom>
      <button role="button" type="button" class="nav-btn" @click="navigate">
        <div class="float-left mr-4 flex h-full w-8">
          <wallet-minimal-icon class="m-auto text-gray-500" :size="32" />
        </div>
        <span class="title">Load read-only wallet</span>
        <span class="subtitle">Enter a public key to load an Ergo wallet in read-only mode.</span>
      </button>
    </router-link>
    <div class="flex-grow"></div>
    <button v-if="hasWallets" class="btn outlined w-full" @click="$router.back()">Cancel</button>
  </div>
</template>
