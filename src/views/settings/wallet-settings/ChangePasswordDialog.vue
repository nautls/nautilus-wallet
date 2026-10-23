<script setup lang="ts">
import { nextTick, ref, useTemplateRef } from "vue";
import { useRegle } from "@regle/core";
import { minLength, required, withMessage, withParams } from "@regle/rules";
import { Loader2Icon } from "@lucide/vue";
import { useI18n } from "vue-i18n";
import { useWalletStore } from "@/stores/walletStore";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from "@/components/ui/drawer";
import { Form, FormField } from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { PasswordError } from "@/common/errors";
import { log } from "@/common/logger";
import { extractErrorMessage } from "@/common/utils";
import { walletsDbService } from "@/database/walletsDbService";

const wallet = useWalletStore();
const { toast } = useToast();
const { t } = useI18n();

const emit = defineEmits(["close"]);

const currentPwdInput = useTemplateRef("current-pwd-input");

const opened = ref(true);
const loading = ref(false);
const walletId = ref(wallet.id);
const currentPassword = ref("");
const newPassword = ref("");
const confirmPassword = ref("");

const { r$ } = useRegle(
  { currentPassword, newPassword, confirmPassword },
  {
    currentPassword: {
      required: withMessage(required, () => t("wallet.requiredSpendingPassword"))
    },
    newPassword: {
      required: withMessage(required, () => t("wallet.spendingPasswordRequired")),
      minLength: withMessage(minLength(10), () =>
        t("wallet.minSpendingPasswordLength", { min: 10 })
      )
    },
    confirmPassword: {
      matches: withMessage(
        withParams((value, pwd) => value === pwd, [newPassword]),
        () => t("settings.wallet.newPasswordsMustMatch")
      )
    }
  },
  { autoDirty: false }
);

async function changePassword() {
  const { valid } = await r$.$validate();
  if (!valid) return;

  try {
    loading.value = true;
    await walletsDbService.changePassword(walletId.value, currentPassword.value, newPassword.value);

    toast({ title: t("settings.wallet.spendingPasswordChanged") });
    setOpened(false);
  } catch (e) {
    if (e instanceof PasswordError) {
      toast({
        title: t("wallet.wrongPassword"),
        variant: "destructive",
        description: t("wallet.wrongPasswordDesc")
      });
      nextTick(() => currentPwdInput.value?.input?.$el.focus());

      return;
    }

    log.error(e);
    toast({
      title: t("settings.wallet.spendingPasswordChangeFailed"),
      variant: "destructive",
      description: extractErrorMessage(e)
    });
  } finally {
    loading.value = false;
  }
}

function reset() {
  currentPassword.value = "";
  newPassword.value = "";
  confirmPassword.value = "";
  r$.$reset();
}

function handleOpenUpdates(open: boolean) {
  if (open) return;

  reset();
  emit("close");
}

function setOpened(open: boolean) {
  if (open) walletId.value = wallet.id;
  else reset();

  opened.value = open;
}

defineExpose({ open: () => setOpened(true), close: () => setOpened(false) });
</script>

<template>
  <Drawer v-model:open="opened" @update:open="handleOpenUpdates">
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>{{ t("settings.wallet.changeSpendingPassword") }}</DrawerTitle>
        <DrawerDescription class="hyphens-auto">{{
          t("settings.wallet.changeSpendingPasswordDesc")
        }}</DrawerDescription>
      </DrawerHeader>

      <Form class="flex flex-col gap-4" @submit="changePassword">
        <FormField :validation="r$.currentPassword">
          <Label for="current-password">{{ t("settings.wallet.currentPassword") }}</Label>
          <PasswordInput
            id="current-password"
            ref="current-pwd-input"
            v-model="currentPassword"
            :disabled="loading"
            @blur="r$.currentPassword.$touch()"
          />
        </FormField>
        <FormField :validation="r$.newPassword">
          <Label for="new-password">{{ t("settings.wallet.newPassword") }}</Label>
          <PasswordInput
            id="new-password"
            v-model="newPassword"
            :disabled="loading"
            @blur="r$.newPassword.$touch()"
          />
        </FormField>
        <FormField :validation="r$.confirmPassword">
          <Label for="confirm-new-password">{{ t("settings.wallet.confirmNewPassword") }}</Label>
          <PasswordInput
            id="confirm-new-password"
            v-model="confirmPassword"
            :disabled="loading"
            @blur="r$.confirmPassword.$touch()"
          />
        </FormField>
      </Form>

      <DrawerFooter>
        <DrawerClose as-child>
          <Button variant="outline" :disabled="loading">{{ t("common.cancel") }}</Button>
        </DrawerClose>
        <Button :disabled="loading" @click="changePassword">
          <Loader2Icon v-if="loading" class="animate-spin" />
          {{ t("common.confirm") }}
        </Button>
      </DrawerFooter>
    </DrawerContent>
  </Drawer>
</template>
