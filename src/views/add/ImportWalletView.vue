<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { english } from "@fleet-sdk/wallet/wordlists";
import { useRegle } from "@regle/core";
import { required, withMessage } from "@regle/rules";
import { FingerprintIcon, KeyRoundIcon, Loader2Icon, LockKeyholeIcon } from "@lucide/vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useAppStore } from "@/stores/appStore";
import { useWalletStore } from "@/stores/walletStore";
import ActionFooter from "@/components/ActionFooter.vue";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Form, FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { Mnemonic } from "@/components/wallet";
import { PasswordError, SessionLockedError } from "@/common/errors";
import { log } from "@/common/logger";
import { extractErrorMessage } from "@/common/utils";
import { validMnemonic, validPublicKey } from "@/validators";
import {
  MasterPasswordSwitch,
  numberSteps,
  provideWalletPassword,
  Stepper,
  StepTitle,
  WalletPasswordFields
} from "./components";

const SUPPORTED_MNEMONIC_LENGTHS = new Set([12, 15, 18, 21, 24]);

const app = useAppStore();
const wallet = useWalletStore();
const router = useRouter();
const { toast } = useToast();
const { t } = useI18n();

const walletName = ref("");
const passwordForm = provideWalletPassword({ userInputs: () => [walletName.value] });
const mnemonicWords = ref<string[]>([]);
const loading = ref(false);
const step = ref(1);
const walletType = ref<"standard" | "readonly">("standard");

const wordsCount = ref(15);
const wordsCountStr = computed({
  get: () => wordsCount.value.toString(),
  set: (v: string) => (wordsCount.value = Number(v))
});

const xpk = ref("");

const mnemonicPhrase = computed(() => mnemonicWords.value.join(" "));
const isReadonly = computed(() => walletType.value === "readonly");
const nextButtonTitle = computed(() => {
  switch (steps.value[step.value]?.key) {
    case "password":
      return passwordForm.createLabel;
    case "secret":
      return isReadonly.value
        ? t("wallet.import.insertPubKey")
        : t("wallet.import.insertRecoveryPhrase");
    default:
      return t("common.import");
  }
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
const allValid = computed(
  () => nameValid.value && (isReadonly.value || (passwordForm.loaded && !passwordForm.invalid))
);

async function validateCredentials() {
  const [{ valid }, credentials] = await Promise.all([
    infoRules.$validate(),
    isReadonly.value ? null : passwordForm.validate({ verify: false })
  ]);

  return valid ? credentials : undefined;
}

const { r$: xpkRules } = useRegle(
  { xpk },
  {
    xpk: {
      required: withMessage(required, () => t("wallet.import.requiredXPubKey")),
      validPublicKey
    }
  },
  { autoDirty: false }
);

const { r$: mnemonicRules } = useRegle(
  { mnemonicPhrase },
  {
    mnemonicPhrase: {
      required: withMessage(required, () => t("wallet.import.requiredRecoveryPhrase")),
      validMnemonic
    }
  },
  { autoDirty: false }
);

onMounted(() => {
  app.viewTitle = t("wallet.index.import");
});

watch(
  wordsCount,
  (length) =>
    (mnemonicWords.value = Array.from({ length }).map((_, i) => mnemonicWords.value[i] ?? "")),
  { immediate: true }
);

async function next() {
  if (current.value === "info") {
    // an existing master password is typed here, and checked before moving on
    const [{ valid }, unlocked] = await Promise.all([
      infoRules.$validate(),
      isReadonly.value || passwordForm.validateUnlock()
    ]);
    if (!valid || !unlocked) return;
  } else if (current.value === "password") {
    if (!(await passwordForm.validate())) return;
  }

  if (step.value < steps.value.length) {
    step.value++;
    return;
  }

  if (isReadonly.value) {
    const { valid } = await xpkRules.$validate();
    if (!valid) return;
  } else {
    const { valid } = await mnemonicRules.$validate();
    if (!valid) return;
  }

  try {
    loading.value = true;
    const credentials = await validateCredentials();
    if (credentials === undefined) {
      goToErrors(infoRules.$invalid || !passwordForm.isNewPassword ? "info" : "password");
      return;
    }

    const walletId = !credentials
      ? await app.putWallet({
          name: walletName.value,
          type: "readonly",
          extendedPublicKey: xpk.value
        })
      : await app.putWallet({
          name: walletName.value,
          type: "standard",
          mnemonic: mnemonicWords.value.join(" "),
          ...credentials
        });

    await wallet.load(walletId, { syncInBackground: false });
    router.push({ name: "assets" });
  } catch (e) {
    if (e instanceof PasswordError) {
      await passwordForm.rejectPassword();
      goToErrors("info");
      return;
    } else if (e instanceof SessionLockedError) {
      await passwordForm.rejectSession();
      goToErrors("info");
      return;
    }

    toast({
      title: t("wallet.import.walletImportError"),
      variant: "destructive",
      description: extractErrorMessage(e)
    });

    log.error(e);
    return;
  } finally {
    loading.value = false;
  }
}

/** Goes back to the step showing the errors. */
function goToErrors(key: "info" | "password") {
  step.value = steps.value.findIndex((s) => s.key === key) + 1;
}

function onPaste(event: ClipboardEvent) {
  if (current.value !== "secret" || isReadonly.value) return;

  const clipboardWords = event.clipboardData?.getData("text")?.split(" ");
  // check if length is supported
  if (!clipboardWords || !SUPPORTED_MNEMONIC_LENGTHS.has(clipboardWords.length)) return;
  // check if all words are in the wordlist
  for (const word of clipboardWords) {
    if (!english.includes(word)) return;
  }

  // set the words
  wordsCount.value = clipboardWords.length;
  mnemonicWords.value = clipboardWords;

  // prevent default paste behavior
  event.preventDefault();
  event.stopPropagation();
}

const steps = computed(() =>
  numberSteps([
    {
      key: "info",
      title: t("wallet.infoStep"),
      description: t("wallet.infoStepDesc"),
      icon: FingerprintIcon,
      enabled: ref(true)
    },
    !isReadonly.value &&
      passwordForm.isNewPassword && {
        key: "password",
        ...passwordForm.stepTexts,
        icon: LockKeyholeIcon,
        enabled: nameValid
      },
    {
      key: "secret",
      title: isReadonly.value ? "Wallet key" : "Wallet secret",
      description: isReadonly.value
        ? t("wallet.import.importStep")
        : t("wallet.import.importStepDesc"),
      icon: KeyRoundIcon,
      enabled: allValid
    }
  ])
);

const current = computed(() => steps.value[step.value - 1].key);
</script>

<template>
  <div class="flex min-h-0 grow flex-col">
    <Stepper v-model="step" :steps="steps" class="shrink-0 p-4" />
    <ScrollArea type="scroll" class="min-h-0 grow">
      <div class="flex flex-col gap-4 px-4 pb-4">
        <StepTitle :step="steps[step - 1]" />

        <Form class="flex flex-col gap-4" @paste="onPaste" @submit="next">
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

            <FormField>
              <Label for="wallet-type">{{ t("wallet.import.walletType") }}</Label>
              <Select v-model="walletType">
                <SelectTrigger id="wallet-type">
                  <SelectValue :placeholder="t('wallet.import.selectWalletType')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="standard">{{ t("wallet.type.standard") }}</SelectItem>
                    <SelectItem value="readonly">{{ t("wallet.type.readonly") }}</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </FormField>

            <MasterPasswordSwitch v-if="!isReadonly" :disabled="loading" />
          </template>

          <WalletPasswordFields v-if="current === 'password'" :disabled="loading" />

          <template v-if="current === 'secret'">
            <template v-if="isReadonly">
              <FormField :validation="xpkRules.xpk">
                <Label for="xpk">{{ t("wallet.xPubKey") }}</Label>
                <Textarea id="xpk" v-model="xpk" class="h-40" @blur="xpkRules.xpk.$touch()" />
              </FormField>
            </template>

            <template v-else>
              <FormField>
                <Select v-model="wordsCountStr">
                  <SelectTrigger>
                    <SelectValue
                      class="font-medium"
                      :placeholder="t('wallet.import.selectSecretType')"
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem
                        v-for="l in SUPPORTED_MNEMONIC_LENGTHS"
                        :key="l"
                        :value="l.toString()"
                        >{{ t("wallet.import.words", { count: l }) }}</SelectItem
                      >
                      <!-- <SelectItem value="sk">Private Key</SelectItem> -->
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </FormField>

              <FormField :validation="mnemonicRules.mnemonicPhrase">
                <Mnemonic :words="mnemonicWords" editable />
              </FormField>
            </template>
          </template>
        </Form>
      </div>
    </ScrollArea>

    <ActionFooter>
      <Button :disabled="loading" size="lg" class="w-full items-center" @click="next">
        <template v-if="loading"
          ><Loader2Icon class="animate-spin" />{{ t("wallet.import.importing") }}</template
        >
        <template v-else>{{ nextButtonTitle }}</template>
      </Button>
    </ActionFooter>
  </div>
</template>
