<script setup lang="ts">
import { computed, HTMLAttributes, ref } from "vue";
import { CircleHelpIcon } from "lucide-vue-next";
import { cn } from "@/common/utils";

const props = defineProps<{
  origin: string;
  favicon?: string;
  class?: HTMLAttributes["class"];
}>();

const hasImageError = ref(false);

const domain = computed(() => props.origin) || "???";
</script>

<template>
  <div :class="cn('mx-auto flex items-center gap-2 text-center text-sm', props.class)">
    <div
      class="mx-auto flex size-7 items-center justify-center rounded-full ring-1 ring-foreground/10 ring-offset-1"
    >
      <img
        v-if="favicon && !hasImageError"
        :src="favicon"
        class="size-7 rounded-full"
        @error="hasImageError = true"
      />
      <CircleHelpIcon v-else class="size-7 text-muted-foreground/60" />
    </div>

    <p v-if="domain" class="truncate">{{ domain }}</p>
  </div>
</template>
