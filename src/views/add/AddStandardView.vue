<template>
  <div class="flex-col flex gap-4 h-full pt-6 pb-4">
    <div class="flex-col flex gap-4 flex-grow">
      <label
        >Wallet name
        <input
          v-model.lazy="walletName"
          :disabled="loading"
          maxlength="50"
          type="text"
          class="w-full control block"
          @blur="v$.walletName.$touch()"
        />
        <p v-if="v$.walletName.$error" class="input-error">
          {{ v$.walletName.$errors[0].$message }}
        </p>
      </label>
      <div class="flex flex-row gap-4">
        <label class="w-1/2"
          >Spending password
          <input
            v-model.lazy="password"
            :disabled="loading"
            type="password"
            class="w-full control block"
            @blur="v$.password.$touch()"
          />
          <p v-if="v$.password.$error" class="input-error">
            {{ v$.password.$errors[0].$message }}
          </p></label
        >
        <label class="w-1/2"
          >Confirm password
          <input
            v-model.lazy="confirmPassword"
            :disabled="loading"
            type="password"
            class="w-full control block"
            @blur="v$.confirmPassword.$touch()"
          />
          <p v-if="v$.confirmPassword.$error" class="input-error">
            {{ v$.confirmPassword.$errors[0].$message }}
          </p></label
        >
      </div>
      <label>
        Recovery phrase
        <div class="input-wrap !text-base bg-gray-100 font-normal leading-relaxed p-2">
          {{ mnemonic }}
        </div>
        <p class="text-xs font-normal p-1">
          Please, make sure you have carefully written down your recovery phrase somewhere safe. You
          will need this phrase to use and restore your wallet.
        </p>
      </label>
      <label
        class="inline-flex items-center font-normal cursor-pointer bg-yellow-100 border-1 border-yellow-300 mb-2 py-1 px-3 rounded w-full"
      >
        <input v-model="mnemonicStoreAgreement" class="checkbox" type="checkbox" />
        <span class="text-yellow-900">I've stored the secret phrase in a secure place.</span>
      </label>
    </div>
    <div>
      <div class="flex flex-row gap-4">
        <button class="btn outlined w-full" @click="$router.back()">Cancel</button>
        <button
          :disabled="loading || !mnemonicStoreAgreement"
          type="button"
          class="w-full btn"
          @click="add()"
        >
          <loading-indicator v-if="loading" class="h-4 w-4 align-middle" />
          <span v-else>Confirm</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { generateMnemonic } from "@fleet-sdk/wallet";
import { english } from "@fleet-sdk/wallet/wordlists";
import { useVuelidate } from "@vuelidate/core";
import { helpers, minLength, required, sameAs } from "@vuelidate/validators";
import { WalletType } from "@/types/internal";
import { DEFAULT_WALLET_STRENGTH } from "@/constants/ergo";
import { useAppStore } from "@/stores/appStore";
import { log } from "@/common/logger";
import { useWalletStore } from "@/stores/walletStore";

export default defineComponent({
  name: "AddStandardView",
  setup() {
    return { v$: useVuelidate(), app: useAppStore(), wallet: useWalletStore() };
  },
  data() {
    return {
      filteredWords: Object.freeze(english),
      walletName: "",
      password: "",
      confirmPassword: "",
      mnemonic: "",
      mnemonicStoreAgreement: false,
      loading: false
    };
  },
  created() {
    this.mnemonic = generateMnemonic(DEFAULT_WALLET_STRENGTH);
  },
  validations() {
    return {
      walletName: { required: helpers.withMessage("Wallet name is required.", required) },
      password: {
        required: helpers.withMessage("Spending password is required.", required),
        minLenght: helpers.withMessage(
          "Spending password requires at least 10 characters.",
          minLength(10)
        )
      },
      confirmPassword: {
        sameAs: helpers.withMessage(
          "'Spending password' and 'Confirm password' must match.",
          sameAs(this.password)
        )
      }
    };
  },
  methods: {
    async add() {
      const valid = await this.v$.$validate();
      if (!valid) return;

      this.loading = true;
      try {
        const walletId = await this.app.putWallet({
          name: this.walletName,
          mnemonic: this.mnemonic,
          password: this.password,
          type: WalletType.Standard
        });

        await this.wallet.load(walletId, { syncInBackground: false });
      } catch (e) {
        log.error(e);
        this.loading = false;
        return;
      }

      this.$router.push({ name: "assets-page" });
    }
  }
});
</script>
