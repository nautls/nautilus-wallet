<template>
  <div class="flex-col flex gap-4 h-full pt-2">
    <div class="flex-col flex gap-4 flex-grow">
      <label
        >Wallet name
        <input
          :disabled="loading"
          v-model.lazy="walletName"
          maxlength="50"
          @blur="v$.walletName.$touch()"
          type="text"
          class="w-full control block"
        />
        <p class="input-error" v-if="v$.walletName.$error">
          {{ v$.walletName.$errors[0].$message }}
        </p>
      </label>
      <div class="flex flex-row gap-4">
        <label class="w-1/2"
          >Spending password
          <input
            :disabled="loading"
            v-model.lazy="password"
            @blur="v$.password.$touch()"
            type="password"
            class="w-full control block"
          />
          <p class="input-error" v-if="v$.password.$error">
            {{ v$.password.$errors[0].$message }}
          </p></label
        >
        <label class="w-1/2"
          >Confirm password
          <input
            :disabled="loading"
            v-model.lazy="confirmPassword"
            @blur="v$.confirmPassword.$touch()"
            type="password"
            class="w-full control block"
          />
          <p class="input-error" v-if="v$.confirmPassword.$error">
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
        <input class="checkbox" type="checkbox" v-model="mnemonicStoreAgreement" />
        <span class="text-yellow-900">I've stored the secret phrase in a secure place.</span>
      </label>
    </div>
    <div>
      <div class="flex flex-row gap-4">
        <button class="btn outlined w-full" @click="$router.back()">Cancel</button>
        <button
          @click="add()"
          :disabled="loading || !mnemonicStoreAgreement"
          type="button"
          class="w-full btn"
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
import { generateMnemonic, wordlists } from "bip39";
import { orderBy, take } from "lodash";
import { mapActions } from "vuex";
import { ACTIONS } from "@/constants/store/actions";
import { WalletType } from "@/types/internal";
import { useVuelidate } from "@vuelidate/core";
import { helpers, minLength, required, sameAs } from "@vuelidate/validators";
import { DEFAULT_WALLET_STRENGTH } from "@/constants/ergo";

const words = wordlists.english;

export default defineComponent({
  name: "AddStandardView",
  setup() {
    return { v$: useVuelidate() };
  },
  created() {
    this.mnemonic = generateMnemonic(DEFAULT_WALLET_STRENGTH);
  },
  data() {
    return {
      filteredWords: Object.freeze(words),
      walletName: "",
      password: "",
      confirmPassword: "",
      mnemonic: "",
      mnemonicStoreAgreement: false,
      loading: false
    };
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
    ...mapActions({ putWallet: ACTIONS.PUT_WALLET }),
    async add() {
      const isValid = await this.v$.$validate();
      if (!isValid) {
        return;
      }

      this.loading = true;
      try {
        await this.putWallet({
          name: this.walletName,
          mnemonic: this.mnemonic,
          password: this.password,
          type: WalletType.Standard
        });
      } catch (e) {
        this.loading = false;
        // eslint-disable-next-line no-console
        console.error(e);
        return;
      }

      this.$router.push({ name: "assets-page" });
    },
    filterBy(text: string) {
      if (text === "" || text.trim() === "") {
        return Object.freeze(take(words, 10));
      }

      const lowerText = text.toLowerCase();
      const filtered = orderBy(
        take(
          words.filter((w) => {
            return w.includes(lowerText);
          }),
          10
        ),
        (w) => !w.startsWith(lowerText)
      );

      this.filteredWords = Object.freeze(filtered);
    }
  }
});
</script>
