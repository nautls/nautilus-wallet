<template>
  <div class="flex flex-col gap-5 h-full">
    <label>
      Receiver
      <input type="text" spellcheck="false" class="w-full control block" />
    </label>
    <div class="flex-grow">
      <div class="flex flex-col gap-2">
        <asset-input
          :label="index === 0 ? 'Assets' : ''"
          v-for="(asset, index) in assets"
          :key="index"
          :asset="asset"
          :disposable="!isErg(asset.tokenId)"
        />
        <p class="text-xs text-right">Fee: 0.0011 ERG</p>
      </div>
    </div>

    <!-- <drop-down>
      <template v-slot:trigger>ERG <vue-feather type="chevron-down" size="16" /></template>
      <template v-slot:items>
        <div class="group">
          <a class="group-item narrow">Test 1</a>
          <a class="group-item narrow">Test 2</a>
          <a class="group-item narrow">Test 3</a>
        </div>
      </template>
    </drop-down> -->

    <div class="flex-shrink"><button class="btn w-full">Confirm</button></div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { GETTERS } from "@/constants/store/getters";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import { StateAsset } from "@/types/internal";
import AssetInput from "@/components/AssetInput.vue";
import { take } from "lodash";

export default defineComponent({
  name: "SendView",
  components: { AssetInput },
  computed: {
    assets(): StateAsset[] {
      return take(this.$store.getters[GETTERS.BALANCE], 2);
    }
  },
  methods: {
    isErg(tokenId: string): boolean {
      return tokenId === ERG_TOKEN_ID;
    }
  }
});
</script>
