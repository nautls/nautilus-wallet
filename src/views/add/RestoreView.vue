<template>
  <div class="flex-col flex gap-4 h-full pt-2">
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
      <label>
        Recovery phrase
        <o-inputitems
          v-model="selectedWords"
          :disabled="loading"
          :data="filteredWords"
          allow-autocomplete
          :allow-new="false"
          :open-on-focus="false"
          field="user.first_name"
          root-class="input-wrap items-select"
          item-class="tag"
          :autocomplete-classes="{
            menuClass: 'autocomplete-list',
            itemClass: 'item',
            itemHoverClass: 'selected'
          }"
          :closable="false"
          :allow-duplicates="true"
          :on-paste-separators="[' ']"
          :confirm-keys="[',', 'Tab', 'Enter', ' ']"
          :keep-first="true"
          @keydown.tab.prevent.stop
          @typing="filterBy"
          @blur="v$.selectedWords.$touch()"
          @paste.prevent.stop="onPaste"
        />
        <p v-if="v$.selectedWords.$error" class="input-error">
          {{ v$.selectedWords.$errors[0].$message }}
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
    </div>
    <div class="flex flex-row gap-4">
      <button class="btn outlined w-full" @click="$router.back()">Cancel</button>
      <button :disabled="loading" type="button" class="w-full btn" @click="add()">
        <loading-indicator v-if="loading" class="h-4 w-4 align-middle" />
        <span v-else>Confirm</span>
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { english } from "@fleet-sdk/wallet/wordlists";
import { intersection, join, orderBy, take } from "lodash-es";
import { isEmpty } from "@fleet-sdk/common";
import { useVuelidate } from "@vuelidate/core";
import { helpers, minLength, required, sameAs } from "@vuelidate/validators";
import { WalletType } from "@/types/internal";
import { validMnemonic } from "@/validators";
import { useAppStore } from "@/stores/appStore";
import { useWalletStore } from "@/stores/walletStore";
import { log } from "@/common/logger";

export default defineComponent({
  name: "RestoreView",
  setup() {
    return { v$: useVuelidate(), app: useAppStore(), wallet: useWalletStore() };
  },
  data() {
    return {
      filteredWords: Object.freeze(english),
      walletName: "",
      password: "",
      confirmPassword: "",
      selectedWords: [] as string[],
      loading: false
    };
  },
  validations() {
    return {
      walletName: { required: helpers.withMessage("Wallet name is required.", required) },
      selectedWords: {
        required: helpers.withMessage("Recovery phrase is required.", required),
        validMnemonic: validMnemonic
      },
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
          mnemonic: join(this.selectedWords, " "),
          password: this.password,
          type: WalletType.Standard
        });

        await this.wallet.load(walletId, { awaitSync: true });
      } catch (e) {
        log.error(e);
        this.loading = false;
        return;
      }

      this.$router.push({ name: "assets-page" });
    },
    filterBy(text: string) {
      if (text === "" || text.trim() === "") {
        this.filteredWords = Object.freeze(take(english, 10));
      }

      const lowerText = text.toLowerCase();
      const filtered = take(
        orderBy(
          english.filter((w) => {
            return w.includes(lowerText);
          }),
          (w) => !w.startsWith(lowerText)
        ),
        10
      );

      this.filteredWords = Object.freeze(filtered);
    },
    onPaste(event: ClipboardEvent) {
      const pasteData = event.clipboardData?.getData("text");
      if (!pasteData) {
        return;
      }

      const pasteWords = pasteData.split(" ");
      if (isEmpty(pasteWords)) {
        return;
      }

      const intersec = intersection(english, pasteWords);

      if (intersec.length == pasteWords.length) {
        // need to paste from pasteWords since intersect doesn't guarantees the order os elements
        this.selectedWords = pasteWords;
      }
    }
  }
});
</script>
