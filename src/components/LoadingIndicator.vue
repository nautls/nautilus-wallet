<template>
  <pulse-loader v-if="type === 'pulse'" :class="class" class="stroke-current inline-block" />
  <circular-loader v-else :class="class" class="stroke-current inline-block" />
</template>

<script lang="ts">
import { defineComponent } from "vue";
import PulseLoader from "@/assets/images/loaders/pulse.svg";
import CircularLoader from "@/assets/images/loaders/circular.svg";

export default defineComponent({
  name: "LoadingIndicator",
  components: {
    PulseLoader,
    CircularLoader
  },
  props: {
    class: { type: String, require: false },
    type: {
      type: String,
      default: "pulse",
      validator(value: string) {
        return ["pulse", "circular"].includes(value);
      }
    }
  }
});
</script>
