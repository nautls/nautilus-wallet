<script setup lang="ts">
import { computed, HTMLAttributes, useId, useSlots } from "vue";
import { CircleAlertIcon } from "@lucide/vue";
import { flatErrors } from "@regle/core";
import { cn } from "@/common/utils";
import { provideFormField } from "./useFormField";

interface Validation {
  $error: boolean;
  $errors: unknown;
}

interface Props {
  class?: HTMLAttributes["class"];
  validation?: Validation;
}

const props = defineProps<Props>();
const slots = useSlots();

const id = useId();
const errorId = `${id}-error`;
const descriptionId = `${id}-description`;

const error = computed<string | undefined>(() => {
  const errors = props.validation?.$errors;
  if (!props.validation?.$error || !errors) return;
  if (Array.isArray(errors)) return errors[0] as string | undefined;
  return flatErrors(errors as Parameters<typeof flatErrors>[0])[0];
});

const invalid = computed(() => !!props.validation?.$error);

provideFormField({
  id,
  invalid,
  describedBy: computed(() => {
    const ids = [error.value && errorId, slots.description && descriptionId].filter(Boolean);
    return ids.length ? ids.join(" ") : undefined;
  })
});
</script>

<template>
  <div data-slot="form-field" :class="cn('flex flex-col gap-2', props.class)">
    <slot />

    <p
      v-if="error"
      :id="errorId"
      data-form-error
      class="text-destructive -mt-0.5 flex items-start gap-1.5 text-xs leading-4"
    >
      <CircleAlertIcon class="size-3.5 shrink-0 translate-y-px" aria-hidden="true" />
      {{ error }}
    </p>
    <p
      v-if="$slots.description"
      :id="descriptionId"
      :class="cn('text-muted-foreground text-xs leading-4', error ? '-mt-1' : '-mt-0.5')"
    >
      <slot name="description" />
    </p>
  </div>
</template>
