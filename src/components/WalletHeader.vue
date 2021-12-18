<template>
  <div class="flex flex-row px-4 pt-4 gap-3 items-center">
    <div class="text-lg ml-3">Nautilus</div>
    <div class="flex-grow">
      <drop-down>
        <template v-slot:trigger>
          <wallet-item :wallet="wallet" :key="wallet.id" />
        </template>
        <template v-slot:items>
          <div class="group">
            <a v-for="wlt in wallets" :key="wlt.id" class="group-item">
              <wallet-item :wallet="wlt" :key="wallet.id" />
            </a>
          </div>
          <div class="group">
            <a class="group-item narrow">Add new wallet</a>
            <a class="group-item narrow">Settings</a>
          </div>
        </template>
      </drop-down>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { mapState } from "vuex";
import NavHeader from "@/components/NavHeader.vue";
import WalletItem from "@/components/WalletItem.vue";
import { StateWallet } from "@/store/stateTypes";

export default defineComponent({
  name: "WalletHeader",
  components: { NavHeader, WalletItem },
  data() {
    return {
      checksum: ""
    };
  },
  computed: {
    ...mapState({
      wallet: "currentWallet"
    }),
    wallets() {
      const currentId = this.$store.state.currentWallet?.id;
      return this.$store.state.wallets.filter((w: StateWallet) => w.id !== currentId);
    }
  }
  // watch: {
  //   wallet: {
  //     deep: true,
  //     handler() {
  //       {
  //         const plate = walletChecksum(this.wallet.extendedPublicKey);
  //         this.checksum = plate.TextPart;
  //         const colorIdx = Buffer.from(plate.ImagePart, "hex")[0] % COLORS.length;
  //         const color = COLORS[colorIdx];
  //       }
  //     }
  //   }
  // }
});
</script>
