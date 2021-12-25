<template>
  <nav class="tabs">
    <router-link to="/assets" active-class="active" class="w-full tab-item">
      <vue-feather type="pie-chart" size="22px" />
    </router-link>
    <router-link to="/" active-class="active" class="w-full tab-item">
      <vue-feather type="image" size="22px" />
    </router-link>
    <router-link to="/transactions" active-class="active" class="w-full tab-item">
      <vue-feather type="clock" size="22px" />
    </router-link>
    <router-link to="/receive" active-class="active" class="w-full tab-item">
      <vue-feather type="download" size="22px" />
    </router-link>
    <router-link to="/send" v-if="!readonly" active-class="active" class="w-full tab-item">
      <vue-feather type="send" size="22px" />
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
