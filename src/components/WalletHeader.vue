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
            <a
              v-for="unselected in unselectedWallets"
              @click="setCurrentWallet(unselected)"
              :key="unselected.id"
              class="group-item"
            >
              <wallet-item :wallet="unselected" :key="wallet.id" />
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
import { mapActions, mapState } from "vuex";
import NavHeader from "@/components/NavHeader.vue";
import WalletItem from "@/components/WalletItem.vue";
import { StateWallet } from "@/store/stateTypes";
import { ACTIONS } from "@/constants/store";

export default defineComponent({
  name: "WalletHeader",
  components: { NavHeader, WalletItem },
  data() {
    return {
      checksum: ""
    };
  },
  methods: {
    ...mapActions({ setCurrentWallet: ACTIONS.SET_CURRENT_WALLET })
  },
  computed: {
    ...mapState({
      wallet: "currentWallet"
    }),
    unselectedWallets() {
      const currentId = this.$store.state.currentWallet?.id;
      return this.$store.state.wallets.filter((w: StateWallet) => w.id !== currentId);
    }
  }
});
</script>
