<script setup lang="ts">
import { HTMLAttributes, InputHTMLAttributes, ref, useTemplateRef } from "vue";
import { EyeIcon, EyeOffIcon } from "lucide-vue-next";
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
      class="absolute cursor-default end-0 inset-y-0 flex text-muted-foreground items-center h-full justify-center pr-3 pl-1 [&_svg]:size-4"
      @click="showPassword = !showPassword"
    >
      <EyeIcon v-if="showPassword" />
      <EyeOffIcon v-else />
    </Button>
  </div>
</template>
