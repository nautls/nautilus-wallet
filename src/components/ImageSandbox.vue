<template>
  <div v-if="loading" :class="class" class="text-center flex">
    <loading-indicator type="circular" class="w-1/3 h-1/3 m-auto stroke-gray-500" />
  </div>
  <iframe
    v-show="!loading"
    @load="loading = false"
    sandbox=""
    :class="class"
    :src="src"
    frameborder="0"
  ></iframe>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
  name: "ImageSandbox",
  props: {
    src: { type: String },
    class: { type: String }
  },
  data() {
    return {
      loading: true
    };
  }
});
</script>
