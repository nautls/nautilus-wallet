<template>
  <div class="flex-col flex gap-3">
    <page-title title="Add read-only wallet" :back-button="true" />
    <div>
      <label
        >Wallet name
        <input
          :disabled="loading"
          maxlength="50"
          type="text"
          @blur="v$.walletName.$touch()"
          v-model.lazy="walletName"
          class="w-full control block"
      /></label>
      <p class="text-danger" v-if="v$.walletName.$error">{{ v$.walletName.$errors[0].$message }}</p>
    </div>
    <div>
      <label class="mt-3">
        Public Key
        <textarea
          @blur="v$.publicKey.$touch()"
          maxlength="156"
          :disabled="loading"
          class="font-mono w-full control block resize-none"
          rows="6"
          v-model.lazy="publicKey"
        ></textarea>
      </label>
      <p class="text-danger" v-if="v$.publicKey.$error">
        {{ v$.publicKey.$errors[0].$message }}
      </p>
      <p class="text-danger" v-if="pkError !== ''">{{ pkError }}</p>
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
import useVuelidate from "@vuelidate/core";
import { required, helpers } from "@vuelidate/validators";
import { validPublicKey } from "@/validators";

export default defineComponent({
  name: "AddReadOnlyView",
  components: { PageTitle, LoadingIndicator },
  setup() {
    return { v$: useVuelidate() };
  },
  data() {
    return {
      loading: false,
      walletName: "",
      publicKey: "",
      pkError: ""
    };
  },
  validations() {
    return {
      walletName: { required: helpers.withMessage("Wallet name is required.", required) },
      publicKey: {
        required: helpers.withMessage("Public key is required.", required),
        validPublicKey
      }
    };
  },
  methods: {
    ...mapActions({ putWallet: ACTIONS.PUT_WALLET }),
    async add() {
      this.pkError = "";
      const isValid = await this.v$.$validate();
      if (!isValid) {
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
        this.pkError = e.message;
        this.loading = false;
        return;
      }

      this.$router.push({ name: "assets-page" });
    }
  }
});
</script>
