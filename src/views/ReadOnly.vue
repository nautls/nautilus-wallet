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
        <vue-feather v-if="loading" type="loader" animation="spin"></vue-feather>
        <span v-else>Confirm</span>
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { mapActions } from "vuex";
import PageTitle from "@/components/PageTitle.vue";
import { WalletType } from "@/types";

export default defineComponent({
  name: "AddReadOnly",
  data() {
    return {
      loading: false,
      walletName: "",
      publicKey: ""
    };
  },
  methods: {
    ...mapActions({ putWallet: "putWallet" }),
    async add() {
      this.loading = true;
      await this.putWallet({
        name: this.walletName,
        extendedPublicKey: this.publicKey,
        type: WalletType.ReadOnly
      });

      this.$router.push({ name: "assets-page" });
    }
  },
  components: { PageTitle }
});
</script>
