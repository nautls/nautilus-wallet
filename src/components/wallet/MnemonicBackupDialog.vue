<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef } from "vue";
import { useRegle } from "@regle/core";
import { required, sameAs, withMessage } from "@regle/rules";
import { Loader2Icon } from "@lucide/vue";
import { useI18n } from "vue-i18n";
import { useWalletStore } from "@/stores/walletStore";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import {
  Drawer,
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
import { extractErrorMessage, unsafeDistinctRand } from "@/common/utils";
import { walletsDbService } from "@/database/walletsDbService";
import Mnemonic from "./Mnemonic.vue";

const wallet = useWalletStore();
const { toast } = useToast();
const { t } = useI18n();

const emit = defineEmits(["close"]);

const pwdInput = useTemplateRef("pwd-input");

const opened = ref(true);
const loading = ref(false);
const step = ref(1);
const walletId = ref(wallet.id);
const password = ref("");
const mnemonicWords = ref<string[]>([]);
const mnemonicWordsConfirm = ref<string[]>([]);
const editableIndexes = ref<number[]>([]);

const mnemonicPhrase = computed(() => mnemonicWords.value.join(" "));
const mnemonicPhraseConfirm = computed(() => mnemonicWordsConfirm.value.join(" "));

const title = computed(() =>
  step.value === 1
    ? t("wallet.backup.title")
    : step.value === 2
      ? t("wallet.create.secretStep")
      : t("wallet.create.secretConfirmStep")
);

const description = computed(() =>
  step.value === 1
    ? t("wallet.backup.passwordStepDesc")
    : step.value === 2
      ? t("wallet.create.secretStepDesc")
      : t("wallet.create.secretConfirmStepDesc")
);

const nextButtonTitle = computed(() =>
  step.value === 1
    ? t("wallet.backup.showRecoveryPhrase")
    : step.value === 2
      ? t("wallet.create.iHaveSavedTheseWords")
      : t("common.confirm")
);

const { r$: passwordRules } = useRegle(
  { password },
  { password: { required: withMessage(required, () => t("wallet.requiredSpendingPassword")) } },
  { autoDirty: false }
);

const { r$: verificationRules } = useRegle(
  { mnemonicPhraseConfirm },
  {
    mnemonicPhraseConfirm: {
      sameAs: withMessage(sameAs(mnemonicPhrase), () => t("wallet.create.recoveryPhraseDoNotMatch"))
    }
  },
  { autoDirty: false }
);

async function next() {
  if (step.value === 1) {
    await unlock();
  } else if (step.value === 2) {
    prepareVerification();
    step.value = 3;
  } else {
    const { valid } = await verificationRules.$validate();
    if (!valid) return;

    toast({ title: t("wallet.backup.success") });
    setOpened(false);
  }
}

async function unlock() {
  const { valid } = await passwordRules.$validate();
  if (!valid) return;

  try {
    loading.value = true;
    const secret = await walletsDbService.getSecret(walletId.value, password.value);
    mnemonicWords.value = secret.trim().split(/\s+/);
    password.value = "";
    passwordRules.$reset();
    step.value = 2;
  } catch (e) {
    if (e instanceof PasswordError) {
      toast({
        title: t("wallet.wrongPassword"),
        variant: "destructive",
        description: t("wallet.wrongPasswordDesc")
      });
      nextTick(() => pwdInput.value?.input?.$el.focus());

      return;
    }

    log.error(e);
    toast({
      title: t("wallet.backup.failed"),
      variant: "destructive",
      description: extractErrorMessage(e)
    });
  } finally {
    loading.value = false;
  }
}

function prepareVerification() {
  const confirm = [...mnemonicWords.value];
  const editable = unsafeDistinctRand(3, 0, confirm.length - 1);
  // Clear 3 random words
  for (const index of editable) {
    confirm[index] = "";
  }

  mnemonicWordsConfirm.value = confirm;
  editableIndexes.value = editable;
  verificationRules.$reset();
}

function reset() {
  step.value = 1;
  password.value = "";
  mnemonicWords.value = [];
  mnemonicWordsConfirm.value = [];
  editableIndexes.value = [];
  passwordRules.$reset();
  verificationRules.$reset();
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
  <Drawer v-model:open="opened" :dismissible="!loading" @update:open="handleOpenUpdates">
    <DrawerContent :dismissible="!loading">
      <DrawerHeader>
        <DrawerTitle>{{ title }}</DrawerTitle>
        <DrawerDescription class="hyphens-auto">{{ description }}</DrawerDescription>
      </DrawerHeader>

      <Form class="flex flex-col gap-4" @submit="next">
        <template v-if="step === 1">
          <FormField :validation="passwordRules.password">
            <Label for="backup-password">{{ t("wallet.spendingPassword") }}</Label>
            <PasswordInput
              id="backup-password"
              ref="pwd-input"
              v-model="password"
              :disabled="loading"
              @blur="passwordRules.password.$touch()"
            />
          </FormField>
        </template>

        <template v-else-if="step === 2">
          <div class="flex flex-col gap-1">
            <CopyButton
              type="button"
              variant="ghost"
              size="icon"
              :content="mnemonicPhrase"
              class="self-end"
            />
            <Mnemonic :words="mnemonicWords" />
          </div>
        </template>

        <template v-else>
          <FormField :validation="verificationRules.mnemonicPhraseConfirm">
            <Mnemonic v-model:words="mnemonicWordsConfirm" :editable="editableIndexes" />
          </FormField>
        </template>
      </Form>

      <DrawerFooter>
        <Button
          class="h-auto min-h-9 text-center whitespace-normal"
          :disabled="loading"
          @click="next"
        >
          <Loader2Icon v-if="loading" class="animate-spin" />
          {{ nextButtonTitle }}
        </Button>
      </DrawerFooter>
    </DrawerContent>
  </Drawer>
</template>
