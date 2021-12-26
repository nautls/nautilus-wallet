<template>
  <page-title title="Add read-only wallet" :back-button="true" />
  <div class="flex-col flex gap-3">
    <div>
      <label
        >Wallet name
        <input
          :disabled="loading"
          maxlength="50"
          type="text"
          v-model.lazy="walletName"
          class="w-full control block"
      /></label>
      <p class="text-danger" v-if="errorMsg.name != ''">{{ errorMsg.name }}</p>
    </div>
    <div>
      <label class="mt-3">
        Public Key
        <textarea
          maxlength="156"
          :disabled="loading"
          class="font-mono w-full control block resize-none"
          rows="6"
          v-model.lazy="publicKey"
        ></textarea>
      </label>
      <p class="text-danger" v-if="errorMsg.pk != ''">{{ errorMsg.pk }}</p>
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
      publicKey: "",
      errorMsg: { name: "", pk: "" }
    };
  },
  methods: {
    ...mapActions({ putWallet: ACTIONS.PUT_WALLET }),
    async add() {
      if (this.walletName === "") {
        this.errorMsg.name = "Wallet name is a required field.";
      } else {
        this.errorMsg.name = "";
      }
      if (this.publicKey === "") {
        this.errorMsg.pk = "Public key is a required field.";
      } else {
        this.errorMsg.pk = "";
      }

      if (this.errorMsg.name !== "" || this.errorMsg.pk !== "") {
        return;
      }

      this.loading = true;
      try {
        await this.putWallet({
          name: this.walletName,
          extendedPublicKey: this.publicKey,
          type: WalletType.ReadOnly
        });
      } catch (e: any) {
        this.errorMsg.pk = "Invalid public key.";
        this.loading = false;
        return;
      }

      this.$router.push({ name: "assets-page" });
    }
  }
});
</script>
