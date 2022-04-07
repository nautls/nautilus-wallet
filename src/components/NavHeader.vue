<template>
  <nav class="tabs">
    <div class="tab-item spacing"></div>
    <router-link to="/assets" active-class="active" class="w-full tab-item">
      <tool-tip position="bottom" label="Assets">
        <vue-feather type="pie-chart" class="m-3" size="22" />
      </tool-tip>
    </router-link>
    <router-link to="/assets/nft" v-if="hasNft" active-class="active" class="w-full tab-item">
      <tool-tip position="bottom" label="NFT gallery">
        <vue-feather type="image" class="m-3" size="22" />
      </tool-tip>
    </router-link>
    <router-link to="/receive" active-class="active" class="w-full tab-item">
      <tool-tip position="bottom" label="Receive">
        <vue-feather type="download" class="m-3" size="22" />
      </tool-tip>
    </router-link>
    <router-link to="/send" v-if="!readonly" active-class="active" class="w-full tab-item">
      <tool-tip position="bottom" label="Send">
        <vue-feather type="send" class="m-3" size="22" />
      </tool-tip>
    </router-link>
    <div class="tab-item spacing"></div>
  </nav>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { WalletType } from "@/types/internal";
import { GETTERS } from "@/constants/store";

export default defineComponent({
  name: "NavHeader",
  computed: {
    readonly(): boolean {
      return this.$store.state.currentWallet.type === WalletType.ReadOnly;
    },
    hasNft(): boolean {
      return this.$store.getters[GETTERS.PICTURE_NFT_BALANCE].length > 0;
    }
  }
});
</script>
