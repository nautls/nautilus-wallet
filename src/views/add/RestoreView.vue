<template>
  <div>
    <page-title title="Restore wallet" :back-button="backButton === 'true'" />
    <div class="flex-col flex gap-3">
      <div>
        <label
          >Wallet name
          <input v-model.lazy="walletName" maxlength="50" type="text" class="w-full control block"
        /></label>
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
            root-class="items-select"
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
          />
        </label>
      </div>
      <div>
        <button @click="add()" type="button" class="w-full btn">
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
import * as bip39 from "bip39";

const words = wordlists.english;

export default defineComponent({
  name: "RestoreView",
  components: { PageTitle },
  props: {
    backButton: { type: String, default: "false" }
  },
  data() {
    return {
      filteredWords: Object.freeze(words),
      walletName: "",
      words: []
    };
  },
  methods: {
    ...mapActions({ putWallet: ACTIONS.PUT_WALLET }),
    async add() {
      console.log(join(this.words, " "));
      try {
        await this.putWallet({
          name: this.walletName,
          seed: await bip39.mnemonicToSeed(join(this.words, " ")),
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
