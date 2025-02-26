<script setup lang="ts">
import { HTMLAttributes } from "vue";
import { english } from "@fleet-sdk/wallet/wordlists";
import { useVModel } from "@vueuse/core";
import WordCombobox from "./WordCombobox.vue";

interface Props {
  words: string[];
  editable?: boolean | number[];
  class?: HTMLAttributes["class"];
  allowPaste?: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{ (e: "update:words", payload: string[]): void }>();

const words = useVModel(props, "words", emit, { passive: true });

function formatIndex(index: number): string {
  return (index + 1).toString().padStart(2, "0");
}

function isEditable(index: number): boolean {
  if (Array.isArray(props.editable)) {
    return props.editable.includes(index);
  }

  return props.editable as boolean;
}
</script>

<template>
  <div :class="props.class">
    <div class="grid grid-flow-row grid-cols-3 gap-1">
      <div v-for="(word, index) in words" :key="index">
        <WordCombobox
          v-if="isEditable(index)"
          v-model="words[index]"
          :prefix="formatIndex(index)"
          class="h-7 gap-1 rounded-sm px-1.5 text-[0.84rem]"
          :options="english"
        />

        <div
          v-else
          class="border-input bg-accent text-accent-foreground ring-offset-background flex h-7 w-full items-center justify-start gap-1 rounded-sm border px-1.5 py-2 text-start text-sm text-[0.84rem] whitespace-nowrap shadow-xs"
        >
          <span class="text-muted-foreground text-xs font-light tabular-nums select-none">
            {{ formatIndex(index) }}
          </span>
          <span>{{ word }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
