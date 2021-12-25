<template>
  <div class="flex flex-row px-4 pt-2 gap-4 items-center">
    <div class="w-9/12">
      <drop-down>
        <template v-slot:trigger>
          <wallet-item
            :wallet="wallet"
            :loading="loading.addresses || loading.balance"
            :key="wallet.id"
          />
        </template>
        <template v-slot:items>
          <div class="group" v-if="unselectedWallets.length > 0">
            <a
              v-for="unselected in unselectedWallets"
              @click="setCurrentWallet(unselected)"
              :key="unselected.id"
              class="group-item"
            >
              <wallet-item :wallet="unselected" :key="wallet.id" />
            </a>
          </div>
          <div class="group" :class="{ 'mt-1': unselectedWallets.length === 0 }">
            <router-link
              :to="{ name: 'add-wallet', params: { backButton: true } }"
              class="group-item narrow"
              >Add new wallet</router-link
            >
          </div>
        </template>
      </drop-down>
    </div>
    <div class="w-3/12">
      <img src="@/assets/images/logo.jpg" class="image-render-auto w-18 float-right mr-2" />
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
      wallet: "currentWallet",
      loading: "loading"
    }),
    unselectedWallets() {
      const currentId = this.$store.state.currentWallet?.id;
      return this.$store.state.wallets.filter((w: StateWallet) => w.id !== currentId);
    }
  }
});
</script>
