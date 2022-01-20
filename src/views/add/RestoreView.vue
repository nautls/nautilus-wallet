<template>
  <div>
    <page-title title="Restore wallet" back-button />
    <div class="flex-col flex gap-3">
      <div>
        <label
          >Wallet name
          <input
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
      </div>
      <div>
        <label class="mt-3">
          Recovery phrase
          <o-inputitems
            v-model="words"
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
            :on-paste-separators="[',', ' ']"
            :confirmKeys="[',', 'Tab', 'Enter', ' ']"
            :keep-first="true"
            @typing="filterBy"
            @blur="v$.words.$touch()"
          />
          <p class="input-error" v-if="v$.words.$error">
            {{ v$.words.$errors[0].$message }}
          </p>
        </label>
      </div>
      <div>
        <label
          >Spending password
          <input
            v-model.lazy="password"
            @blur="v$.password.$touch()"
            type="password"
            class="w-full control block"
          />
          <p class="input-error" v-if="v$.password.$error">
            {{ v$.password.$errors[0].$message }}
          </p></label
        >
      </div>
      <div>
        <label
          >Confirm password
          <input
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
      <div>
        <button @click="add()" type="button" class="w-full btn mt-3">
          <span>Confirm</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import PageTitle from "@/components/PageTitle.vue";
import { wordlists } from "bip39";
import { join, orderBy, take } from "lodash";
import { mapActions } from "vuex";
import { ACTIONS } from "@/constants/store/actions";
import { WalletType } from "@/types/internal";
import { useVuelidate } from "@vuelidate/core";
import { helpers, minLength, required, sameAs } from "@vuelidate/validators";
import { validMnemonic } from "@/validators";

const words = wordlists.english;

export default defineComponent({
  name: "RestoreView",
  components: { PageTitle },
  setup() {
    return { v$: useVuelidate() };
  },
  data() {
    return {
      filteredWords: Object.freeze(words),
      walletName: "",
      password: "",
      confirmPassword: "",
      words: []
    };
  },
  validations() {
    return {
      walletName: { required: helpers.withMessage("Wallet name is required.", required) },
      words: {
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
      console.log(join(this.words, " "));
      try {
        await this.putWallet({
          name: this.walletName,
          mnemonic: join(this.words, " "),
          password: this.password,
          type: WalletType.Standard
        });
      } catch (e: any) {
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
          words.filter(w => {
            return w.includes(lowerText);
          }),
          10
        ),
        w => !w.startsWith(lowerText)
      );

      this.filteredWords = Object.freeze(filtered);
    }
  }
});
</script>
