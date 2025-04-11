<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { generateMnemonic } from "@fleet-sdk/wallet";
import { useVuelidate } from "@vuelidate/core";
import { helpers, minLength, required, sameAs } from "@vuelidate/validators";
import {
  CheckIcon,
  FingerprintIcon,
  KeyRoundIcon,
  Loader2Icon,
  RotateCwIcon
} from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useAppStore } from "@/stores/appStore";
import { useWalletStore } from "@/stores/walletStore";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Form, FormField } from "@/components/ui/form";
import { Input, PasswordInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { Mnemonic } from "@/components/wallet";
import { log } from "@/common/logger";
import { extractErrorMessage } from "@/common/utils";
import { DEFAULT_WALLET_STRENGTH } from "@/constants/ergo";
import { WalletType } from "@/types/internal";
import { Step, Stepper, StepTitle } from "./components";

const app = useAppStore();
const wallet = useWalletStore();
const router = useRouter();
const { toast } = useToast();
const { t } = useI18n();

const step = ref(1);
const walletName = ref("");
const password = ref("");
const confirmPassword = ref("");
const loading = ref(false);

const mnemonicPhrase = ref("");
const mnemonicWordsConfirm = ref<string[]>([]);
const strength = ref(DEFAULT_WALLET_STRENGTH);
const editableIndexes = ref<number[]>([]);

const mnemonicWords = computed(() => mnemonicPhrase.value.split(" "));
const mnemonicPhraseConfirm = computed(() => mnemonicWordsConfirm.value.join(" "));

const nextButtonTitle = computed(() =>
  step.value === 1
    ? t("wallet.create.createRecoveryPhrase")
    : step.value === 2
      ? t("wallet.create.iHaveSavedTheseWords")
      : t("common.confirm")
);

const infoRules = useVuelidate(
  {
    walletName: {
      required: helpers.withMessage(t("wallet.requiredWalletName"), required)
    },
    password: {
      required: helpers.withMessage(t("wallet.spendingPasswordRequired"), required),
      minLength: helpers.withMessage(
        t("wallet.minSpendingPasswordLength", { min: 10 }),
        minLength(10)
      )
    },
    confirmPassword: {
      sameAs: helpers.withMessage(t("wallet.passwordsMustMatch"), sameAs(password))
    }
  },
  { walletName, password, confirmPassword }
);

const verificationRules = useVuelidate(
  {
    mnemonicPhraseConfirm: {
      sameAs: helpers.withMessage(
        t("wallet.create.recoveryPhraseDoNotMatch"),
        sameAs(mnemonicPhrase)
      )
    }
  },
  { mnemonicPhraseConfirm }
);

onMounted(newMnemonic);

watch(strength, newMnemonic);

watch(step, () => {
  if (step.value !== 3) return;

  const confirm = [...mnemonicWords.value];
  const editable = generateUniqueRandomNumbers(3, 0, confirm.length - 1);
  // Clear 3 random words
  for (const index of editable) {
    confirm[index] = "";
  }

  mnemonicWordsConfirm.value = confirm;
  editableIndexes.value = editable;
  verificationRules.value.$reset();
});

function generateUniqueRandomNumbers(n: number, start: number, end: number): number[] {
  if (n > end - start + 1) {
    throw new Error("Cannot generate more unique numbers than the range allows");
  }

  const numbers = new Set<number>();
  while (numbers.size < n) {
    const num = Math.floor(Math.random() * (end - start + 1)) + start;
    numbers.add(num);
  }

  return Array.from(numbers);
}

async function next() {
  if (step.value === 1) {
    const valid = await infoRules.value.$validate();
    if (!valid) return;
  } else if (step.value === 3) {
    const valid = await verificationRules.value.$validate();
    if (!valid) return;
  }

  if (step.value < steps.length) {
    step.value++;
    return;
  }

  try {
    loading.value = true;
    const walletId = await app.putWallet({
      name: walletName.value,
      mnemonic: mnemonicPhrase.value,
      password: password.value,
      type: WalletType.Standard
    });

    await wallet.load(walletId, { syncInBackground: false });
    router.push({ name: "assets" });
  } catch (e) {
    toast({
      title: t("wallet.create.walletCreationErrorTitle"),
      variant: "destructive",
      description: extractErrorMessage(e)
    });

    log.error(e);
    return;
  } finally {
    loading.value = false;
  }
}

function newMnemonic() {
  mnemonicPhrase.value = generateMnemonic(strength.value);
}

const steps: Step[] = [
  {
    step: 1,
    title: t("wallet.infoStepTitle"),
    description: t("wallet.infoStepDescription"),
    icon: FingerprintIcon,
    enabled: ref(true)
  },
  {
    step: 2,
    title: t("wallet.create.secretStepTitle"),
    description: t("wallet.create.secretStepDescription"),
    icon: KeyRoundIcon,
    enabled: computed(() => !infoRules.value.$invalid)
  },
  {
    step: 3,
    title: t("wallet.create.secretConfirmStepTitle"),
    description: t("wallet.create.secretConfirmStepDescription"),
    icon: CheckIcon,
    enabled: computed(() => !infoRules.value.$invalid)
  }
];
</script>

<template>
  <Stepper v-model="step" :steps="steps" />

  <div class="flex h-full flex-col gap-6 p-6 pt-4">
    <StepTitle :step="steps[step - 1]" />

    <Form class="flex h-full grow flex-col justify-start gap-4" @submit="next">
      <template v-if="step === 1">
        <FormField :validation="infoRules.walletName">
          <Label for="wallet-name">{{ t("wallet.walletName") }}</Label>
          <Input
            id="wallet-name"
            v-model="walletName"
            :disabled="loading"
            maxlength="50"
            type="text"
            @blur="infoRules.walletName.$touch()"
          />
        </FormField>

        <Separator class="my-2" />

        <FormField :validation="infoRules.password">
          <Label for="password">{{ t("wallet.spendingPassword") }}</Label>
          <PasswordInput
            id="password"
            v-model="password"
            :disabled="loading"
            type="password"
            @blur="infoRules.password.$touch()"
          />
        </FormField>
        <FormField :validation="infoRules.confirmPassword">
          <Label for="confirm-password">{{ t("wallet.confirmPassword") }}</Label>
          <PasswordInput
            id="confirm-password"
            v-model="confirmPassword"
            :disabled="loading"
            type="password"
            @blur="infoRules.confirmPassword.$touch()"
          />
        </FormField>
      </template>

      <template v-else-if="step === 2">
        <Tabs v-model="strength" class="flex w-full items-center gap-0">
          <TabsList class="flex">
            <TabsTrigger class="w-full" :value="160">{{
              t("wallet.words", { count: 15 })
            }}</TabsTrigger>
            <TabsTrigger class="w-full" :value="256">{{
              t("wallet.words", { count: 24 })
            }}</TabsTrigger>
          </TabsList>
          <div class="grow"></div>
          <Button type="button" variant="ghost" size="icon" @click="newMnemonic">
            <RotateCwIcon />
          </Button>
          <CopyButton
            type="button"
            variant="ghost"
            size="icon"
            :content="mnemonicPhrase"
            class="top-4 right-4"
          />
        </Tabs>

        <Mnemonic :words="mnemonicWords" />
      </template>

      <template v-if="step === 3">
        <FormField :validation="verificationRules.mnemonicPhraseConfirm">
          <Mnemonic v-model:words="mnemonicWordsConfirm" :editable="editableIndexes" />
        </FormField>
      </template>
    </Form>

    <div class="flex flex-row gap-4">
      <Button :disabled="loading" class="w-full items-center" @click="next">
        <template v-if="loading"
          ><Loader2Icon class="animate-spin" />{{ t("wallet.create.creating") }}</template
        >
        <template v-else>{{ nextButtonTitle }}</template>
      </Button>
    </div>
  </div>
</template>
