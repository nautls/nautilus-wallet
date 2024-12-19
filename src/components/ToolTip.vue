<template>
  <span class="group relative inline-flex justify-center">
    <slot />
    <span
      class="pointer-events-none absolute z-10 my-1 w-auto w-max select-none rounded px-3 py-2 text-center font-sans text-xs font-normal tracking-wide opacity-0 shadow-lg transition-all duration-150 ease-linear group-hover:opacity-95"
      :class="customClass"
    >
      <slot name="label" v-if="$slots.label" />
      <span class="break-anywhere" v-html="label" v-else></span>
    </span>
  </span>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
  name: "ToolTip",
  computed: {
    customClass(): string[] {
      const cl = [this.position === "top" ? "bottom-full" : "top-full"];
      switch (this.type) {
        case "success":
          cl.push("bg-green-600 text-light-50");
          break;
        case "default":
        default:
          cl.push("bg-dark-100 text-light-300");
          break;
      }

      if (this.tipClass) {
        cl.push(this.tipClass);
      }

      return cl;
    }
  },
  props: {
    label: { type: String, required: false },
    position: { type: String, default: "top" },
    type: { type: String, default: "default" },
    tipClass: { type: String, requred: false }
  }
});
</script>
