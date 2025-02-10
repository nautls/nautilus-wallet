<script setup lang="ts">
import { computed, HTMLAttributes, ref, watch } from "vue";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/common/utils";

interface Props {
  phrase: string;
  editable?: boolean;
  class?: HTMLAttributes["class"];
}

const props = defineProps<Props>();
const words = ref<string[]>([]);

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

watch(
  () => props.phrase,
  (phrase) => {
    words.value = phrase.split(" ");
  },
  { immediate: true }
);

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
            <div v-if="editable" class="relative">
              <Input v-model="words[index]" class="h-8 pl-8" />
              <span
                class="absolute inset-y-0 start-0 flex items-center px-3 font-light tabular-nums text-muted-foreground"
                >{{ formatIndex(index) }}</span
              >
            </div>
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
