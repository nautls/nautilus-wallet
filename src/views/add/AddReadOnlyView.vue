<template>
  <div class="flex-col flex gap-4 h-full pt-2">
    <div class="flex flex-col gap-4 flex-grow">
      <label
        >Wallet name
        <input
          :disabled="loading"
          maxlength="50"
          type="text"
          @blur="v$.walletName.$touch()"
          v-model.lazy="walletName"
          class="w-full control block"
        />
        <p class="input-error" v-if="v$.walletName.$error">
          {{ v$.walletName.$errors[0].$message }}
        </p>
      </label>

      <label class="mt-3">
        Extended public key
        <textarea
          @blur="v$.publicKey.$touch()"
          maxlength="156"
          :disabled="loading"
          class="font-mono w-full control block resize-none"
          rows="6"
          v-model.lazy="publicKey"
        ></textarea>
        <p class="input-error" v-if="v$.publicKey.$error">
          {{ v$.publicKey.$errors[0].$message }}
        </p>
      </label>
      <p class="input-error" v-if="pkError !== ''">{{ pkError }}</p>
    </div>
    <div class="flex flex-row gap-4">
      <button class="btn outlined w-full" @click="$router.back()">Cancel</button>
      <button type="button" :disabled="loading" @click="add()" class="w-full btn">
        <loading-indicator v-if="loading" class="h-4 w-4 align-middle" />
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
import useVuelidate from "@vuelidate/core";
import { required, helpers } from "@vuelidate/validators";
import { validPublicKey } from "@/validators";

export default defineComponent({
  name: "AddReadOnlyView",
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
        required: helpers.withMessage("Extended public key is required.", required),
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
