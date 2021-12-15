<template>
  <div class="flex flex-row-reverse p-4 gap-3">
    <div class="w-min">
      <canvas
        class="rounded h-10 ring-2 ring-gray-400 ring-offset-1 w-10 inline-block"
        id="checksum-img"
      ></canvas>
    </div>
    <div class="flex-grow leading-none">
      <div class="flex flex-col h-full align-bottom whitespace-nowrap">
        <div class="font-semibold h-1/2">{{ wallet.name }}</div>
        <div class="h-1/2">
          <small>{{ checksum }}</small>
          <small class="rounded bg-light-800 mx-1 text-xs py-1 px-2 text-gray-500 uppercase">{{
            $filters.walletType(wallet.type)
          }}</small>
        </div>
      </div>
    </div>
    <div class="flex-grow text-lg ml-3 pt-1.5">Nautilus</div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { mapState } from "vuex";
import { walletChecksum } from "@emurgo/cip4-js";
import { renderIcon } from "@download/blockies";
import NavHeader from "@/components/NavHeader.vue";

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
  components: { NavHeader },
  data() {
    return {
      checksum: ""
    };
  },
  name: "WalletHeader",
  computed: {
    ...mapState({
      wallet: "currentWallet"
    })
  },
  watch: {
    wallet: {
      deep: true,
      handler() {
        {
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
            document.getElementById("checksum-img")
          );
        }
      }
    }
  }
});
</script>
