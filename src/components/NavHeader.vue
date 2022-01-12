<template>
  <nav class="tabs">
    <router-link to="/assets" active-class="active" class="w-full tab-item">
      <tool-tip position="bottom" label="Assets">
        <vue-feather type="pie-chart" class="m-3" size="24" />
      </tool-tip>
    </router-link>
    <router-link to="/receive" active-class="active" class="w-full tab-item">
      <tool-tip position="bottom" label="Receive">
        <vue-feather type="download" class="m-3" size="24" />
      </tool-tip>
    </router-link>
    <router-link to="/send" v-if="!readonly" active-class="active" class="w-full tab-item">
      <tool-tip position="bottom" label="Send">
        <vue-feather type="send" class="m-3" size="24" />
      </tool-tip>
    </router-link>
  </nav>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { WalletType } from "@/types/internal";

export default defineComponent({
  name: "NavHeader",
  computed: {
    readonly(): boolean {
      return this.$store.state.currentWallet.type === WalletType.ReadOnly;
    }
  }
});
</script>
