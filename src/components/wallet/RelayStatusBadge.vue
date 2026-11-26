<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "@/common/utils";
import type { DisplayedHealth } from "@/composables/useDisplayedHealth";

const props = defineProps<{
  health: DisplayedHealth;
  label: string;
  class?: HTMLAttributes["class"];
}>();
</script>

<template>
  <!-- the live region stays mounted, so screen readers announce each change of its text -->
  <span :class="cn('pointer-events-none block size-2', props.class)">
    <Transition
      enter-from-class="scale-50 opacity-0"
      leave-to-class="scale-50 opacity-0"
      enter-active-class="ease-snap transition-[scale,opacity] duration-150 motion-reduce:transition-none"
      leave-active-class="transition-[scale,opacity] duration-200 ease-in motion-reduce:transition-none"
    >
      <span
        v-if="health !== 'live'"
        data-relay-status
        :data-health="health"
        :class="[
          'ring-background relative block size-full rounded-full ring-[1.5px]',
          {
            'bg-muted-foreground': health === 'loading',
            'border-warning bg-background border-[1.5px]':
              health === 'reconnecting' || health === 'waiting',
            'bg-destructive': health === 'error',
            'bg-success': health === 'connected'
          }
        ]"
      >
        <span
          v-if="health === 'loading' || health === 'reconnecting'"
          data-relay-ripple
          :class="[
            'motion-safe:animate-ripple absolute rounded-full motion-reduce:hidden',
            health === 'loading'
              ? 'bg-muted-foreground inset-0'
              : 'border-warning -inset-[1.5px] border-[1.5px]'
          ]"
        />
      </span>
    </Transition>
    <span role="status" class="sr-only">{{ health === "live" ? "" : label }}</span>
  </span>
</template>
