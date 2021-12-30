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
            v-model="tags"
            :data="filteredTags"
            autocomplete
            :allow-new="false"
            :open-on-focus="false"
            field="user.first_name"
            root-class="itens-select"
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
import * as bip39 from "bip39";
import { take } from "lodash";

const data = bip39.wordlists.english;

export default defineComponent({
  name: "RestoreFromMnemonic",
  components: { PageTitle },
  props: {
    backButton: { type: String, default: "false" }
  },
  data() {
    return {
      filteredTags: data,
      tags: [],
      allowNew: true,
      openOnFocus: true
    };
  },
  methods: {
    getFilteredTags(text: string) {
      this.filteredTags = take(
        data.filter(option => {
          return option.indexOf(text.toLowerCase()) >= 0;
        }),
        10
      );
    }
  }
});
</script>
