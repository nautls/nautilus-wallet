<template>
  <div>
    <page-title title="Welcome to Ergo Wallet." :back-button="backButton === 'true'" />
    <p class="pt-2 pb-5">
      <button type="button" class="nav-btn">
        <span class="title">Create wallet</span>
        <span class="subtitle"
          >Generate a 15-word recovery phrase and create a new Ergo wallet.</span
        >
      </button>
    </p>
    <p class="pb-5">
      <button type="button" class="nav-btn">
        <span class="title">Restore wallet</span>
        <span class="subtitle"
          >Enter a recovery phrase to restore an already-existing Ergo wallet.</span
        >
      </button>
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

export default defineComponent({
  name: "AddView",
  components: { PageTitle },
  props: {
    backButton: { type: String, default: "false" }
  }
});
</script>