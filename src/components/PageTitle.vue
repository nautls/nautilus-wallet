<template>
  <div class="flex flex-row text-lg pb-10 pt-1 text-center">
    <div class="w-1/12">
      <a @click="$router.back()" class="back-btn">
        <vue-feather v-if="backButton" type="chevron-left" size="24" />
      </a>
    </div>
    <div class="flex-grow">
      <h1 class="leading-tight">{{ title }}</h1>
    </div>
    <div class="w-1/12"></div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
  name: "PageTitle",
  props: {
    title: { type: String, require: true },
    backButton: { type: Boolean, default: false },
  },
});
</script>
