<template>
  <page-title title="Add read-only wallet" :back-button="true" />
  <div class="flex-col flex gap-3">
    <div>
      <label
        >Wallet name
        <input
          :disabled="loading"
          type="text"
          v-model.lazy="walletName"
          class="w-full control block"
      /></label>
    </div>
    <div>
      <label class="mt-3">
        Public Key
        <textarea
          :disabled="loading"
          class="font-mono text-base w-full control block resize-none"
          rows="6"
          v-model.lazy="publicKey"
        ></textarea>
      </label>
    </div>
    <div>
      <button type="button" :disabled="loading" @click="add()" class="w-full btn">
        <loading-indicator v-if="loading" class="h-7 w-7" />
        <span v-else>Confirm</span>
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { mapActions } from "vuex";
import { WalletType } from "@/types/internal";
import { ACTIONS } from "@/constants/store/actions";
import PageTitle from "@/components/PageTitle.vue";
import LoadingIndicator from "@/components/LoadingIndicator.vue";

export default defineComponent({
  name: "AddReadOnlyView",
  components: { PageTitle, LoadingIndicator },
  data() {
    return {
      loading: false,
      walletName: "",
      publicKey: ""
    };
  },
  methods: {
    ...mapActions({ putWallet: ACTIONS.PUT_WALLET }),
    async add() {
      this.loading = true;
      await this.putWallet({
        name: this.walletName,
        extendedPublicKey: this.publicKey,
        type: WalletType.ReadOnly
      });

      this.$router.push({ name: "assets-page" });
    }
  }
});
</script>
