<template>
  <div class="flex flex-row w-full gap-2 items-center">
    <div class="flex-grow flex">
      <div class="flex flex-col gap-1 h-auto text-left whitespace-nowrap">
        <div class="font-semibold text-base h-1/2">{{ wallet.name }}</div>
        <div class="h-1/2 text-xs">
          <span>{{ checksum }}</span>
          <small class="rounded bg-gray-300 mx-2 py-1 px-2 text-dark-200 uppercase">{{
            $filters.walletType(wallet.type)
          }}</small>
          <loading-indicator v-if="loading" class="w-4 h-4" />
        </div>
      </div>
    </div>
    <canvas
      class="rounded h-11 w-11 ring-1 ring-gray-400 ring-offset-1 inline-block"
      :id="`wlt-checksum-${wallet.id}`"
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
    loading: { type: Boolean, default: false }
  },
  data() {
    return {
      checksum: ""
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
              document.getElementById(`wlt-checksum-${this.wallet.id}`)
            );
          });
        }
      }
    }
  },
  components: { LoadingIndicator }
});
</script>
