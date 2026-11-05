<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { generateMnemonic } from "@fleet-sdk/wallet";
import { useRegle } from "@regle/core";
import { required, sameAs, withMessage } from "@regle/rules";
import {
  CheckIcon,
  FingerprintIcon,
  KeyRoundIcon,
  Loader2Icon,
  LockKeyholeIcon,
  RotateCwIcon
} from "@lucide/vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useAppStore } from "@/stores/appStore";
import { useWalletStore } from "@/stores/walletStore";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Form, FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { Mnemonic } from "@/components/wallet";
import { log } from "@/common/logger";
import { extractErrorMessage, unsafeDistinctRand } from "@/common/utils";
import { DEFAULT_WALLET_STRENGTH } from "@/constants/ergo";
import {
  MasterPasswordSwitch,
  provideWalletPassword,
  Step,
  Stepper,
  StepTitle,
  WalletPasswordFields
} from "./components";

const app = useAppStore();
const wallet = useWalletStore();
const router = useRouter();
const { toast } = useToast();
const { t } = useI18n();

type StepKey = "info" | "password" | "phrase" | "confirm";

const step = ref(1);
const walletName = ref("");
const passwordForm = provideWalletPassword();
const loading = ref(false);

const mnemonicPhrase = ref("");
const mnemonicWordsConfirm = ref<string[]>([]);
const strength = ref(DEFAULT_WALLET_STRENGTH);
const editableIndexes = ref<number[]>([]);

const mnemonicWords = computed(() => mnemonicPhrase.value.split(" "));
const mnemonicPhraseConfirm = computed(() => mnemonicWordsConfirm.value.join(" "));

onMounted(() => {
  app.viewTitle = t("wallet.index.create");
});

const { r$: infoRules } = useRegle(
  { walletName },
  {
    walletName: {
      required: withMessage(required, () => t("wallet.requiredWalletName"))
    }
  },
  { autoDirty: false }
);

const nameValid = computed(() => !infoRules.$invalid);
const allValid = computed(() => nameValid.value && passwordForm.loaded && !passwordForm.invalid);

const steps = computed<(Step & { key: StepKey })[]>(() => {
  const all: (Step & { key: StepKey })[] = [
    {
      key: "info",
      step: 0,
      title: t("wallet.infoStep"),
      description: t("wallet.infoStepDesc"),
      icon: FingerprintIcon,
      enabled: ref(true)
    },
    {
      key: "password",
      step: 0,
      ...passwordStepInfo(),
      icon: LockKeyholeIcon,
      enabled: nameValid
    },
    {
      key: "phrase",
      step: 0,
      title: t("wallet.create.secretStep"),
      description: t("wallet.create.secretStepDesc"),
      icon: KeyRoundIcon,
      enabled: allValid
    },
    {
      key: "confirm",
      step: 0,
      title: t("wallet.create.secretConfirmStep"),
      description: t("wallet.create.secretConfirmStepDesc"),
      icon: CheckIcon,
      enabled: allValid
    }
  ];

  return all
    .filter((s) => s.key !== "password" || passwordForm.isNewPassword)
    .map((s, i) => ({ ...s, step: i + 1 }));
});

const current = computed(() => steps.value[step.value - 1].key);

function passwordStepInfo() {
  return passwordForm.useMaster
    ? { title: t("wallet.masterPassword"), description: t("wallet.masterPasswordStepDesc") }
    : { title: t("wallet.walletPassword"), description: t("wallet.walletPasswordStepDesc") };
}

const nextButtonTitle = computed(() => {
  switch (steps.value[step.value]?.key) {
    case "password":
      return passwordForm.useMaster
        ? t("wallet.createMasterPassword")
        : t("wallet.createWalletPassword");
    case "phrase":
      return t("wallet.create.backUpRecoveryPhrase");
    case "confirm":
      return t("wallet.create.iHaveSavedTheseWords");
    default:
      return t("common.confirm");
  }
});

const { r$: verificationRules } = useRegle(
  { mnemonicPhraseConfirm },
  {
    mnemonicPhraseConfirm: {
      sameAs: withMessage(sameAs(mnemonicPhrase), () => t("wallet.create.recoveryPhraseDoNotMatch"))
    }
  },
  { autoDirty: false }
);

onMounted(newMnemonic);

watch(strength, newMnemonic);

watch(current, () => {
  if (current.value !== "confirm") return;

  const confirm = [...mnemonicWords.value];
  const editable = unsafeDistinctRand(3, 0, confirm.length - 1);
  // Clear 3 random words
  for (const index of editable) {
    confirm[index] = "";
  }

  mnemonicWordsConfirm.value = confirm;
  editableIndexes.value = editable;
  verificationRules.$reset();
});

async function next() {
  if (!(await validateStep(current.value))) return;

  if (step.value < steps.value.length) {
    step.value++;
    return;
  }

  await create(false);
}

async function validateStep(key: StepKey): Promise<boolean> {
  switch (key) {
    case "info": {
      // an existing master password is typed here, and checked before moving on
      const [{ valid }, credentials] = await Promise.all([
        infoRules.$validate(),
        passwordForm.isNewPassword || passwordForm.validate()
      ]);
      return valid && !!credentials;
    }
    case "password":
      return !!(await passwordForm.validate());
    case "confirm":
      return (await verificationRules.$validate()).valid;
    default:
      return true;
  }
}

async function skipBackup() {
  await create(true);
}

async function create(needsBackup: boolean) {
  try {
    loading.value = true;
    const [{ valid }, credentials] = await Promise.all([
      infoRules.$validate(),
      passwordForm.validate()
    ]);
    if (!valid || !credentials) {
      // back to the step showing the errors
      const key = !valid || !passwordForm.isNewPassword ? "info" : "password";
      step.value = steps.value.findIndex((s) => s.key === key) + 1;
      return;
    }

    const walletId = await app.putWallet({
      name: walletName.value,
      mnemonic: mnemonicPhrase.value,
      type: "standard",
      needsBackup,
      ...credentials
    });

    await wallet.load(walletId, { syncInBackground: false });
    router.push({ name: "assets" });
  } catch (e) {
    toast({
      title: t("wallet.create.walletCreationError"),
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
</script>

<template>
  <div class="flex h-full flex-col gap-4 p-4">
    <Stepper v-model="step" :steps="steps" />
    <StepTitle :step="steps[step - 1]" />

    <Form class="flex h-full grow flex-col justify-start gap-4" @submit="next">
      <template v-if="current === 'info'">
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

        <MasterPasswordSwitch :disabled="loading" />
      </template>

      <WalletPasswordFields v-if="current === 'password'" :disabled="loading" />

      <template v-if="current === 'phrase'">
        <Tabs v-model="strength" class="flex w-full flex-row items-center gap-0">
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

      <template v-if="current === 'confirm'">
        <FormField :validation="verificationRules.mnemonicPhraseConfirm">
          <Mnemonic v-model:words="mnemonicWordsConfirm" :editable="editableIndexes" />
        </FormField>
      </template>
    </Form>

    <div class="flex flex-col gap-2">
      <Button
        :disabled="loading"
        class="h-auto min-h-9 w-full items-center text-center whitespace-normal"
        @click="next"
      >
        <template v-if="loading"
          ><Loader2Icon class="animate-spin" />{{ t("wallet.create.creating") }}</template
        >
        <template v-else>{{ nextButtonTitle }}</template>
      </Button>
      <Button
        v-if="!loading && (current === 'phrase' || current === 'confirm')"
        variant="ghost"
        class="w-full"
        @click="skipBackup"
      >
        {{ t("wallet.create.skipBackup") }}
      </Button>
    </div>
  </div>
</template>
