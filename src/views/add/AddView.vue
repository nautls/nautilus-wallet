<template>
  <div>
    <page-title title="Welcome to Nautilus." :back-button="hasWallets" />
    <p class="pt-2 pb-5">
      <router-link to="/add/new" custom v-slot="{ navigate }">
        <button type="button" @click="navigate" @keypress.enter="navigate" class="nav-btn">
          <span class="title">Create wallet</span>
          <span class="subtitle"
            >Generate a 15-word recovery phrase and create a new Ergo wallet.</span
          >
        </button>
      </router-link>
    </p>
    <p class="pb-5">
      <router-link to="/add/restore" custom v-slot="{ navigate }">
        <button type="button" @click="navigate" @keypress.enter="navigate" class="nav-btn">
          <span class="title">Restore wallet</span>
          <span class="subtitle"
            >Enter a recovery phrase to restore an already-existing Ergo wallet.</span
          >
        </button>
      </router-link>
    </p>
    <p class="pb-5">
      <router-link to="/add/hw/ledger" custom v-slot="{ navigate }">
        <button type="button" @click="navigate" @keypress.enter="navigate" class="nav-btn">
          <span class="title">Connect a harware wallet</span>
          <span class="subtitle"
            >Create or restore an Ergo wallet using a Ledger hardware wallet.</span
          >
        </button>
      </router-link>
    </p>
    <p class="pb-5">
      <router-link to="/add/read-only" custom v-slot="{ navigate }">
        <button
          @click="navigate"
          @keypress.enter="navigate"
          role="button"
          type="button"
          class="nav-btn"
        >
          <span class="title">Load read-only wallet</span>
          <span class="subtitle">Enter a public key to load an Ergo wallet in read-only mode.</span>
        </button>
      </router-link>
    </p>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import PageTitle from "@/components/PageTitle.vue";
import { isEmpty } from "lodash";

export default defineComponent({
  name: "AddView",
  components: { PageTitle },
  computed: {
    hasWallets() {
      return !isEmpty(this.$store.state.wallets);
    }
  },
  props: {
    backButton: { type: String, default: "false" }
  }
});
</script>
