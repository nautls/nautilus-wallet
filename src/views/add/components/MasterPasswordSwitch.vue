<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { FormField } from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { injectWalletPassword } from "./walletPassword";

const props = defineProps<{ disabled?: boolean }>();

const { t } = useI18n();
const form = injectWalletPassword();

const isDisabled = computed(() => props.disabled || form.verifying || !form.loaded);
</script>

<!-- An existing master password is typed right here, since it has no step of its own. -->
<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between gap-4">
      <Label for="use-master-password" class="flex flex-col items-start gap-1">
        {{ t("wallet.useMasterPassword") }}
        <span class="text-muted-foreground text-xs font-normal">
          {{ t("wallet.useMasterPasswordDesc") }}
        </span>
      </Label>
      <Switch id="use-master-password" v-model="form.useMaster" :disabled="isDisabled" />
    </div>

    <FormField v-if="form.mode === 'unlock'" :validation="form.rules.password">
      <Label :disabled="isDisabled" for="password">{{ t("wallet.masterPassword") }}</Label>
      <PasswordInput
        id="password"
        v-model="form.password"
        :disabled="isDisabled"
        type="password"
        @blur="form.rules.password.$touch()"
      />
      <template #description>{{ t("wallet.masterPasswordUnlockDesc") }}</template>
    </FormField>
  </div>
</template>
