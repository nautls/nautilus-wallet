<script setup lang="ts">
import { onMounted } from "vue";
import { TriangleAlertIcon } from "@lucide/vue";
import type { Score } from "@zxcvbn-ts/core";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormField } from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PasswordStrength from "@/components/PasswordStrength.vue";
import { loadScorer } from "@/composables/usePasswordStrength";

interface FieldValidation {
  $error: boolean;
  $errors: unknown;
  $touch(): void;
}

interface NewPasswordForm {
  password: string;
  confirmPassword: string;
  strength?: Score;
  rules: { password: FieldValidation; confirmPassword: FieldValidation };
}

const props = defineProps<{
  form: NewPasswordForm;
  id: string;
  label: string;
  confirmLabel: string;
  warning?: string;
  disabled?: boolean;
}>();

const fields = props.form;

onMounted(loadScorer);
</script>

<template>
  <FormField :validation="fields.rules.password">
    <Label :disabled="disabled" :for="id">{{ label }}</Label>
    <PasswordInput
      :id="id"
      v-model="fields.password"
      :disabled="disabled"
      @blur="fields.rules.password.$touch()"
    />
    <PasswordStrength :score="fields.password ? fields.strength : undefined" />
  </FormField>

  <FormField :validation="fields.rules.confirmPassword">
    <Label :disabled="disabled" :for="`confirm-${id}`">{{ confirmLabel }}</Label>
    <PasswordInput
      :id="`confirm-${id}`"
      v-model="fields.confirmPassword"
      :disabled="disabled"
      @blur="fields.rules.confirmPassword.$touch()"
    />
  </FormField>

  <Alert v-if="warning" class="py-2 text-xs">
    <TriangleAlertIcon />
    <AlertDescription class="text-xs">{{ warning }}</AlertDescription>
  </Alert>
</template>
