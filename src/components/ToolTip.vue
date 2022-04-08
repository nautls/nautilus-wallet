<template>
  <span class="inline-flex group justify-center relative">
    <slot />
    <span
      class="w-max rounded font-normal font-sans tracking-wide shadow-lg text-center text-xs my-1 w-auto opacity-0 py-2 px-3 transition-all ease-linear z-10 duration-150 absolute pointer-events-none group-hover:opacity-95"
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
