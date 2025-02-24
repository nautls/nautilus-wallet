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
import { useRouter } from "vue-router";
import { useAppStore } from "@/stores/appStore";
import { useWalletStore } from "@/stores/walletStore";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Form, FormField } from "@/components/ui/form";
import { Input, PasswordInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { DefaultStepper, Step } from "@/components/ui/stepper";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { Mnemonic } from "@/components/wallet";
import { log } from "@/common/logger";
import { extractErrorMessage } from "@/common/utils";
import { DEFAULT_WALLET_STRENGTH } from "@/constants/ergo";
import { WalletType } from "@/types/internal";

const app = useAppStore();
const wallet = useWalletStore();
const router = useRouter();
const { toast } = useToast();

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
const nexButtonTitle = computed(() =>
  step.value === 1
    ? "Create a recovery phrase"
    : step.value === 2
      ? "I've saved these words"
      : "Verify"
);

const infoRules = useVuelidate(
  {
    walletName: { required: helpers.withMessage("Wallet name is required.", required) },
    password: {
      required: helpers.withMessage("Spending password is required.", required),
      minLength: helpers.withMessage(
        "Spending password requires at least 10 characters.",
        minLength(10)
      )
    },
    confirmPassword: {
      sameAs: helpers.withMessage(
        "'Spending password' and 'Confirm password' must match.",
        sameAs(password)
      )
    }
  },
  { walletName, password, confirmPassword }
);

const verificationRules = useVuelidate(
  {
    mnemonicPhraseConfirm: {
      sameAs: helpers.withMessage(
        "The recovery phrase does not match the original one.",
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
      title: "Error creating wallet",
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
    title: "Info",
    icon: FingerprintIcon,
    enabled: ref(true)
  },
  {
    step: 2,
    title: "Secret",
    icon: KeyRoundIcon,
    enabled: computed(() => !infoRules.value.$invalid)
  },
  {
    step: 3,
    title: "Verify",
    icon: CheckIcon,
    enabled: computed(() => !infoRules.value.$invalid)
  }
];
</script>

<template>
  <DefaultStepper v-model="step" :steps="steps" class="py-2" />

  <div class="flex h-full flex-col gap-6 p-6 pt-4">
    <Form class="flex h-full grow flex-col justify-start gap-4" @submit="next">
      <template v-if="step === 1">
        <FormField :validation="infoRules.walletName">
          <Label for="wallet-name">Wallet name</Label>
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
          <Label for="password">Spending password</Label>
          <PasswordInput
            id="password"
            v-model="password"
            :disabled="loading"
            type="password"
            @blur="infoRules.password.$touch()"
          />
        </FormField>
        <FormField :validation="infoRules.confirmPassword">
          <Label for="confirm-password">Confirm password</Label>
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
            <TabsTrigger class="w-full" :value="160">15 words</TabsTrigger>
            <TabsTrigger class="w-full" :value="256">24 words</TabsTrigger>
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
          <Label for="confirm-mnemonic" class="flex flex-col gap-1 pb-3"
            >Confirm your recovery phrase
            <span class="text-muted-foreground text-xs font-normal"
              >Complete the missing parts of your recovery phrase.</span
            ></Label
          >

          <Mnemonic v-model:words="mnemonicWordsConfirm" :editable="editableIndexes" />
        </FormField>
      </template>
    </Form>

    <div class="flex flex-row gap-4">
      <Button :disabled="loading" class="w-full items-center" @click="next">
        <template v-if="loading"><Loader2Icon class="animate-spin" />Creating wallet...</template>
        <template v-else>{{ nexButtonTitle }}</template>
      </Button>
    </div>
  </div>
</template>
