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
      <label>
        Recovery phrase
        <o-inputitems
          :disabled="loading"
          v-model="selectedWords"
          :data="filteredWords"
          autocomplete
          :allow-new="false"
          :open-on-focus="false"
          field="user.first_name"
          root-class="input-wrap items-select"
          item-class="tag"
          :autocompleteClasses="{
            menuClass: 'autocomplete-list',
            itemClass: 'item',
            itemHoverClass: 'selected'
          }"
          :closable="false"
          :allow-duplicates="true"
          :on-paste-separators="[' ']"
          :confirmKeys="[',', 'Tab', 'Enter', ' ']"
          :keep-first="true"
          @typing="filterBy"
          @blur="v$.selectedWords.$touch()"
          @paste.prevent.stop="onPaste"
        />
        <p class="input-error" v-if="v$.selectedWords.$error">
          {{ v$.selectedWords.$errors[0].$message }}
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
    </div>
    <div class="flex flex-row gap-4">
      <button class="btn outlined w-full" @click="$router.back()">Cancel</button>
      <button @click="add()" :disabled="loading" type="button" class="w-full btn">
        <loading-indicator v-if="loading" class="h-4 w-4 align-middle" />
        <span v-else>Confirm</span>
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { wordlists } from "bip39";
import { intersection, isEmpty, join, orderBy, take } from "lodash";
import { mapActions } from "vuex";
import { ACTIONS } from "@/constants/store/actions";
import { WalletType } from "@/types/internal";
import { useVuelidate } from "@vuelidate/core";
import { helpers, minLength, required, sameAs } from "@vuelidate/validators";
import { validMnemonic } from "@/validators";

const wordlist = wordlists.english;

export default defineComponent({
  name: "RestoreView",
  setup() {
    return { v$: useVuelidate() };
  },
  data() {
    return {
      filteredWords: Object.freeze(wordlist),
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
          mnemonic: join(this.selectedWords, " "),
          password: this.password,
          type: WalletType.Standard
        });
      } catch (e: any) {
        this.loading = false;
        console.error(e);
        return;
      }

      this.$router.push({ name: "assets-page" });
    },
    filterBy(text: string) {
      if (text === "" || text.trim() === "") {
        this.filteredWords = Object.freeze(take(wordlist, 10));
      }

      const lowerText = text.toLowerCase();
      const filtered = take(
        orderBy(
          wordlist.filter((w) => {
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

      const intersec = intersection(wordlist, pasteWords);

      if (intersec.length == pasteWords.length) {
        // need to paste from pasteWords since intersect doesn't garantees the order os elements
        this.selectedWords = pasteWords;
      }
    }
  }
});
</script>
