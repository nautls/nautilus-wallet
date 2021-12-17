<template>
  <div class="flex flex-row p-4 gap-3 items-center">
    <div class="text-lg ml-3">Nautilus</div>
    <div class="flex-grow">
      <div class="text-left w-full relative inline-block">
        <button
          class="bg-white border rounded rounded-b-none border-b-0 border-gray-300 w-full p-4 text-gray-700 gap-2 items-center inline-flex justify-center hover:bg-gray-100 focus:outline-none"
        >
          <wallet-item :wallet="wallet" :key="wallet.id" />
          <vue-feather type="chevron-down" />
        </button>

        <div
          class="divide-y bg-white border rounded rounded-t-none divide-gray-100 border-t-0 border-gray-300 shadow-lg w-full max-h-120 origin-top-right right-0 overflow-y-auto absolute focus:outline-none"
          tabindex="-1"
        >
          <div class="pb-1" role="none">
            <a
              v-for="wlt in wallets"
              :key="wlt.id"
              href="#"
              class="py-4 px-4 text-gray-700 block hover:bg-gray-100"
            >
              <wallet-item :wallet="wlt" :key="wallet.id" />
            </a>
          </div>
          <div class="py-1">
            <a href="#" class="text-sm py-2 px-4 text-gray-700 block">Add new wallet</a>
            <a href="#" class="text-sm py-2 px-4 text-gray-700 block">Settings</a>
          </div>
        </div>
      </div>
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
