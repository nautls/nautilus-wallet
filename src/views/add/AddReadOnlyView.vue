<template>
  <div class="flex h-full flex-col gap-4 pb-4 pt-6">
    <div class="flex flex-grow flex-col gap-4">
      <label
        >Wallet name
        <input
          v-model.lazy="walletName"
          :disabled="loading"
          maxlength="50"
          type="text"
          class="control block w-full"
          @blur="v$.walletName.$touch()"
        />
        <p v-if="v$.walletName.$error" class="input-error">
          {{ v$.walletName.$errors[0].$message }}
        </p>
      </label>

      <label class="mt-3">
        Extended public key
        <textarea
          v-model.lazy="publicKey"
          maxlength="156"
          :disabled="loading"
          class="control block w-full resize-none font-mono"
          rows="6"
          @blur="v$.publicKey.$touch()"
        ></textarea>
        <p v-if="v$.publicKey.$error" class="input-error">
          {{ v$.publicKey.$errors[0].$message }}
        </p>
      </label>
      <p v-if="pkError !== ''" class="input-error">{{ pkError }}</p>
    </div>
    <div class="flex flex-row gap-4">
      <button class="btn outlined w-full" @click="$router.back()">Cancel</button>
      <button type="button" :disabled="loading" class="btn w-full" @click="add()">
        <loading-indicator v-if="loading" class="h-4 w-4 align-middle" />
        <span v-else>Confirm</span>
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { useVuelidate } from "@vuelidate/core";
import { helpers, required } from "@vuelidate/validators";
import { useAppStore } from "@/stores/appStore";
import { useWalletStore } from "@/stores/walletStore";
import { log } from "@/common/logger";
import { WalletType } from "@/types/internal";
import { validPublicKey } from "@/validators";

export default defineComponent({
  name: "AddReadOnlyView",
  setup() {
    return { v$: useVuelidate(), app: useAppStore(), wallet: useWalletStore() };
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
    async add() {
      this.pkError = "";
      const valid = await this.v$.$validate();
      if (!valid) return;

      this.loading = true;
      try {
        const walletId = await this.app.putWallet({
          name: this.walletName,
          extendedPublicKey: this.publicKey,
          type: WalletType.ReadOnly
        });

        await this.wallet.load(walletId, { syncInBackground: false });
      } catch (e) {
        log.error(e);

        this.pkError = e instanceof Error ? e.message : "Unknown error.";
        this.loading = false;
        return;
      }

      this.$router.push({ name: "assets" });
    }
  }
});
</script>
