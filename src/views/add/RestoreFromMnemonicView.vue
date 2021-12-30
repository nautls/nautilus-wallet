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

const data = [
  {
    id: 1,
    user: { first_name: "Jesse", last_name: "Simmons" },
    date: "2016/10/15 13:43:27",
    gender: "Male"
  },
  {
    id: 2,
    user: { first_name: "John", last_name: "Jacobs" },
    date: "2016/12/15 06:00:53",
    gender: "Male"
  },
  {
    id: 3,
    user: { first_name: "Tina", last_name: "Gilbert" },
    date: "2016/04/26 06:26:28",
    gender: "Female"
  },
  {
    id: 4,
    user: { first_name: "Clarence", last_name: "Flores" },
    date: "2016/04/10 10:28:46",
    gender: "Male"
  },
  {
    id: 5,
    user: { first_name: "Anne", last_name: "Lee" },
    date: "2016/12/06 14:38:38",
    gender: "Female"
  },
  {
    id: 6,
    user: { first_name: "Sara", last_name: "Armstrong" },
    date: "2016/09/23 18:50:04",
    gender: "Female"
  }
];

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
      this.filteredTags = data.filter(option => {
        return option.user.first_name.toString().toLowerCase().indexOf(text.toLowerCase()) >= 0;
      });
    }
  }
});
</script>
