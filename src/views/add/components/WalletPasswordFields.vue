<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import NewPasswordFields from "@/components/NewPasswordFields.vue";
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
    <NewPasswordFields
      id="password"
      :form="form"
      :label="isMaster ? t('wallet.masterPassword') : t('wallet.walletPassword')"
      :confirm-label="t('wallet.confirmPassword')"
      :warning="
        isMaster
          ? t('wallet.masterPasswordNotRecoverable')
          : t('wallet.walletPasswordNotRecoverable')
      "
      :disabled="isDisabled"
    />
  </div>
</template>
