<script setup lang="ts">
import { HTMLAttributes, InputHTMLAttributes, ref, useTemplateRef } from "vue";
import { EyeIcon, EyeOffIcon } from "@lucide/vue";
import { Button } from "../button";
import { Input } from ".";

const props = defineProps<{
  id?: HTMLAttributes["id"];
  disabled?: InputHTMLAttributes["disabled"];
}>();

const showPassword = ref(false);
const input = useTemplateRef("input");

defineExpose({ input });
</script>

<template>
  <div class="relative w-full items-center">
    <Input
      :id="props.id"
      v-bind="$attrs"
      ref="input"
      :disabled="props.disabled"
      :type="showPassword ? 'text' : 'password'"
      class="pr-8"
    />
    <Button
      size="condensed"
      variant="minimal"
      type="button"
      :disabled="props.disabled"
      tabindex="-1"
      class="text-muted-foreground absolute inset-y-0 end-0 flex h-full cursor-default items-center justify-center pr-3 pl-1 [&_svg]:size-4"
      @click="showPassword = !showPassword"
    >
      <EyeOffIcon v-if="showPassword" />
      <EyeIcon v-else />
    </Button>
  </div>
</template>
