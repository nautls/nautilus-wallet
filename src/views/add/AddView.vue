<template>
  <div class="flex flex-col gap-4 h-full">
    <div class="flex-grow"></div>
    <router-link to="/add/new" custom v-slot="{ navigate }">
      <button type="button" @click="navigate" @keypress.enter="navigate" class="nav-btn">
        <div class="h-full float-left flex w-8 mr-4">
          <mdi-icon name="wallet-plus" size="32" class="m-auto text-gray-500" />
        </div>
        <span class="title">Create wallet</span>
        <span class="subtitle"
          >Generate a 15-word recovery phrase and create a new Ergo wallet.</span
        >
      </button>
    </router-link>
    <router-link to="/add/restore" custom v-slot="{ navigate }">
      <button type="button" @click="navigate" @keypress.enter="navigate" class="nav-btn">
        <div class="h-full float-left flex w-8 mr-4">
          <mdi-icon name="backup-restore" size="32" class="m-auto text-gray-500" />
        </div>
        <span class="title">Restore wallet</span>
        <span class="subtitle"
          >Enter a recovery phrase to restore an already-existing Ergo wallet.</span
        >
      </button>
    </router-link>
    <router-link to="/add/hw/ledger" custom v-slot="{ navigate, href }">
      <button
        type="button"
        @click="navInTab(navigate, href)"
        @keypress.enter="navInTab(navigate, href)"
        class="nav-btn"
      >
        <div class="h-full float-left flex w-8 mr-4">
          <ledger-logo class="w-6 h-6 m-auto fill-gray-500" />
          <!-- <mdi-icon name="wallet-plus" size="32" class="m-auto text-gray-500" /> -->
        </div>
        <span class="title">Connect a hardware wallet</span>
        <span class="subtitle"
          >Create or restore an Ergo wallet using a Ledger hardware wallet.</span
        >
      </button>
    </router-link>
    <router-link to="/add/read-only" custom v-slot="{ navigate }">
      <button
        @click="navigate"
        @keypress.enter="navigate"
        role="button"
        type="button"
        class="nav-btn"
      >
        <div class="h-full float-left flex w-8 mr-4">
          <mdi-icon name="wallet-outline" size="32" class="m-auto text-gray-500" />
        </div>
        <span class="title">Load read-only wallet</span>
        <span class="subtitle">Enter a public key to load an Ergo wallet in read-only mode.</span>
      </button>
    </router-link>
    <div class="flex-grow"></div>
    <button class="btn outlined w-full" v-if="hasWallets" @click="$router.back()">Cancel</button>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { isEmpty } from "lodash";
import { Browser, isPopup } from "@/utils/browserApi";
import LedgerLogo from "@/assets/images/hw-devices/ledger-logo.svg";

export default defineComponent({
  name: "AddView",
  components: {
    LedgerLogo
  },
  computed: {
    hasWallets() {
      return !isEmpty(this.$store.state.wallets);
    }
  },
  props: {
    backButton: { type: String, default: "false" }
  },
  methods: {
    navInTab(navigate: () => {}, href: string) {
      if (!isPopup() || !Browser.tabs) {
        navigate();
      }

      Browser.tabs.create({
        url: Browser.extension.getURL(`index.html${href}?redirect=false`),
        active: true
      });
      window.close();
    }
  }
});
</script>
