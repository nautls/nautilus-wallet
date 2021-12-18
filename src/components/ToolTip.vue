<template>
  <span class="inline-flex group justify-center relative">
    <span>
      <slot />
    </span>
    <span
      class="rounded font-sans bg-dark-400 bottom-full shadow-lg text-center text-xs mb-2 w-auto opacity-0 py-2 px-3 transition-all ease-linear text-light-200 z-10 duration-150 absolute pointer-events-none group-hover:opacity-100"
    >
      <slot name="label" v-if="$slots.label" />
      <span class="whitespace-nowrap" v-else>{{ label }}</span>
      <svg
        class="top-full h-2 w-full left-0 text-dark-400 absolute"
        x="0px"
        y="0px"
        viewBox="0 0 255 255"
        xml:space="preserve"
      >
        <polygon class="fill-current" points="0,0 127.5,127.5 255,0" />
      </svg>
    </span>
  </span>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
  name: "ToolTip",
  props: {
    label: { type: String, required: false },
    color: { type: String, required: false }
  }
});
</script>
