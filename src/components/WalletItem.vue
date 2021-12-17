<template>
  <div class="flex flex-row w-full gap-2 items-center">
    <div class="flex-grow flex">
      <div class="flex flex-col h-auto text-left whitespace-nowrap">
        <div class="font-semibold h-1/2">{{ wallet.name }}</div>
        <div class="h-1/2">
          <small>{{ checksum }}</small>
          <small class="rounded bg-light-800 mx-1 text-xs py-1 px-2 text-gray-500 uppercase">{{
            $filters.walletType(wallet.type)
          }}</small>
        </div>
      </div>
    </div>
    <canvas
      class="rounded h-10 ring-2 ring-gray-400 ring-offset-1 w-10 inline-block"
      :id="`wlt-checksum-${wallet.id}`"
    ></canvas>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { walletChecksum } from "@emurgo/cip4-js";
import { renderIcon } from "@download/blockies";

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
    wallet: { type: Object, required: true }
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
  }
});
</script>
