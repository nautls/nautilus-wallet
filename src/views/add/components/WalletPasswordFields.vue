<script setup lang="ts">
import { computed } from "vue";
import { TriangleAlertIcon } from "@lucide/vue";
import { useI18n } from "vue-i18n";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormField } from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { injectWalletPassword } from "./walletPassword";

const props = defineProps<{ disabled?: boolean }>();

const { t } = useI18n();
const form = injectWalletPassword();

const isDisabled = computed(() => props.disabled || form.verifying || !form.loaded);
const isMaster = computed(() => form.mode !== "separate");
</script>

<!-- The password step: a new master password, or the wallet's own password. -->
<template>
  <div class="flex flex-col gap-4">
    <FormField :validation="form.rules.password">
      <Label :disabled="isDisabled" for="password">{{
        isMaster ? t("wallet.masterPassword") : t("wallet.walletPassword")
      }}</Label>
      <PasswordInput
        id="password"
        v-model="form.password"
        :disabled="isDisabled"
        type="password"
        @blur="form.rules.password.$touch()"
      />
    </FormField>

    <FormField :validation="form.rules.confirmPassword">
      <Label :disabled="isDisabled" for="confirm-password">{{ t("wallet.confirmPassword") }}</Label>
      <PasswordInput
        id="confirm-password"
        v-model="form.confirmPassword"
        :disabled="isDisabled"
        type="password"
        @blur="form.rules.confirmPassword.$touch()"
      />
    </FormField>

    <Alert class="py-2 text-xs">
      <TriangleAlertIcon />
      <AlertDescription class="text-xs">
        {{
          isMaster
            ? t("wallet.masterPasswordNotRecoverable")
            : t("wallet.walletPasswordNotRecoverable")
        }}
      </AlertDescription>
    </Alert>
  </div>
</template>
