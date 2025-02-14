<script setup lang="ts">
import { computed, HTMLAttributes } from "vue";
import { english } from "@fleet-sdk/wallet/wordlists";
import { useVModel } from "@vueuse/core";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/common/utils";
import WordCombobox from "./WordCombobox.vue";

interface Props {
  words: string[];
  editable?: boolean;
  class?: HTMLAttributes["class"];
}

const props = defineProps<Props>();
const emit = defineEmits<{ (e: "update:words", payload: string[]): void }>();

const words = useVModel(props, "words", emit, { passive: true });

const colRows = computed(() => {
  switch (words.value.length) {
    case 12:
      return "grid-rows-6";
    case 15:
      return "grid-rows-8";
    case 18:
      return "grid-rows-9";
    case 21:
      return "grid-rows-11";
    case 24:
    default:
      return "grid-rows-12";
  }
});

function formatIndex(index: number): string {
  return (index + 1).toString().padStart(2, "0");
}
</script>

<template>
  <div :class="cn('h-full rounded-md border border-input py-1 text-sm', props.class)">
    <ScrollArea class="h-full text-sm">
      <div class="h-10 px-4">
        <div class="grid grid-flow-col gap-2 py-3" :class="colRows">
          <div v-for="(word, index) in words" :key="index" class="space-x-2">
            <WordCombobox
              v-if="editable"
              v-model="words[index]"
              :prefix="formatIndex(index)"
              class="h-8"
              :options="english"
            />

            <template v-else>
              <span class="font-light tabular-nums text-muted-foreground">{{
                formatIndex(index)
              }}</span>
              <span class="font-semibold">{{ word }}</span>
            </template>
          </div>
        </div>
      </div>
    </ScrollArea>
  </div>
</template>
