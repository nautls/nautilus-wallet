<template>
  <div class="flex flex-row gap-3 items-center w-full h-10">
    <div class="flex flex-col gap-0.5 h-full w-full text-left whitespace-nowrap">
      <div class="font-semibold text-sm w-40 h-full truncate" :class="{ 'text-right': reverse }">
        {{ wallet.name }}
      </div>
      <div
        class="h-full text-xs flex items-center flex-row gap-1"
        :class="{ 'flex-row-reverse': reverse }"
      >
        <small class="align-middle font-normal">{{ checksum }}</small>
        <small class="rounded bg-gray-200 px-1 font-normal text-dark-200 uppercase">{{
          $filters.walletType(wallet.type)
        }}</small>
        <mdi-icon
          class="align-middle"
          name="incognito"
          size="16"
          v-if="wallet.settings.avoidAddressReuse"
        />
        <loading-indicator v-if="loading" class="w-4 h-4" />
      </div>
    </div>

    <canvas
      class="rounded w-9 h-9 ring-1 ring-gray-300 ring-offset-1 inline-block"
      :id="canvaId"
    ></canvas>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { walletChecksum } from "@emurgo/cip4-js";
import { renderIcon } from "@download/blockies";
import LoadingIndicator from "./LoadingIndicator.vue";

const mkcolor = (primary: string, secondary: string, spots: string) => ({
  primary,
  secondary,
  spots
});

const COLORS = [
  mkcolor("#17D1AA", "#E1F2FF", "#A80B32"),
  mkcolor("#FA5380", "#E1F2FF", "#0833B2"),
  mkcolor("#F06EF5", "#E1F2FF", "#0804F7"),
  mkcolor("#EBB687", "#E1F2FF", "#852D62"),
  mkcolor("#F59F9A", "#E1F2FF", "#085F48")
];

export default defineComponent({
  name: "WalletItem",
  props: {
    wallet: { type: Object, required: true },
    loading: { type: Boolean, default: false },
    reverse: { type: Boolean, default: false }
  },
  data() {
    return {
      checksum: "",
      canvaId: Object.freeze(
        `wlt-checksum-${this.wallet.id}-${new Date().valueOf() + Math.random()}`
      )
    };
  },
  watch: {
    wallet: {
      deep: true,
      immediate: true,
      handler() {
        {
          this.$nextTick(() => {
            const plate = walletChecksum(this.wallet.extendedPublicKey);
            this.checksum = plate.TextPart;
            const colorIdx = Buffer.from(plate.ImagePart, "hex")[0] % COLORS.length;
            const color = COLORS[colorIdx];
            renderIcon(
              {
                seed: plate.ImagePart,
                size: 7,
                scale: 4,
                color: color.primary,
                bgcolor: color.secondary,
                spotcolor: color.spots
              },
              document.getElementById(this.canvaId)
            );
          });
        }
      }
    }
  },
  components: { LoadingIndicator }
});
</script>
