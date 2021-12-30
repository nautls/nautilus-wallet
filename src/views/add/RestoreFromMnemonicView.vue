<template>
  <div>
    <page-title title="Restore wallet" :back-button="backButton === 'true'" />
    <div class="flex-col flex gap-3">
      <div>
        <label>Wallet name <input maxlength="50" type="text" class="w-full control block" /></label>
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
            @typing="getFilteredTags"
          />
        </label>
      </div>
      <div>
        <button type="button" class="w-full btn">
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
import { orderBy, take } from "lodash";

const words = wordlists.english;

export default defineComponent({
  name: "RestoreFromMnemonic",
  components: { PageTitle },
  props: {
    backButton: { type: String, default: "false" }
  },
  data() {
    return {
      filteredWords: Object.freeze(words),
      words: []
    };
  },
  methods: {
    getFilteredTags(text: string) {
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
