<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { english } from "@fleet-sdk/wallet/wordlists";
import { useVuelidate } from "@vuelidate/core";
import { helpers, minLength, required, requiredIf, sameAs } from "@vuelidate/validators";
import { FingerprintIcon, KeyRoundIcon, Loader2Icon } from "lucide-vue-next";
import { useRouter } from "vue-router";
import { useAppStore } from "@/stores/appStore";
import { useWalletStore } from "@/stores/walletStore";
import { Button } from "@/components/ui/button";
import { Form, FormField } from "@/components/ui/form";
import { Input, PasswordInput } from "@/components/ui/input";
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
import { log } from "@/common/logger";
import { extractErrorMessage } from "@/common/utils";
import { WalletType } from "@/types/internal";
import { validMnemonic, validPublicKey } from "@/validators";
import { Step, Stepper, StepTitle } from "./components";

const SUPPORTED_MNEMONIC_LENGTHS = new Set([12, 15, 18, 21, 24]);

const app = useAppStore();
const wallet = useWalletStore();
const router = useRouter();
const { toast } = useToast();

const walletName = ref("");
const password = ref("");
const confirmPassword = ref("");
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
  if (step.value === 1) {
    return isReadonly.value ? "Insert a public key" : "Insert a recovery phrase";
  } else {
    return "Import";
  }
});

const infoRules = useVuelidate(
  {
    walletName: { required: helpers.withMessage("Wallet name is required.", required) },
    password: {
      required: helpers.withMessage(
        "Spending password is required.",
        requiredIf(() => !isReadonly.value)
      ),
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

const xpkRules = useVuelidate(
  {
    xpk: {
      required: helpers.withMessage("Extended public key is required.", required),
      validPublicKey
    }
  },
  { xpk }
);

const mnemonicRules = useVuelidate(
  {
    mnemonicPhrase: {
      required: helpers.withMessage("Recovery phrase is required.", required),
      validMnemonic
    }
  },
  { mnemonicPhrase }
);

watch(walletType, () => {
  password.value = "";
  confirmPassword.value = "";

  infoRules.value.password.$reset();
  infoRules.value.confirmPassword.$reset();
});

watch(
  wordsCount,
  (length) =>
    (mnemonicWords.value = Array.from({ length }).map((_, i) => mnemonicWords.value[i] ?? "")),
  { immediate: true }
);

async function next() {
  if (step.value === 1) {
    const valid = await infoRules.value.$validate();
    if (!valid) return;
  }

  if (step.value < steps.value.length) {
    step.value++;
    return;
  }

  if (isReadonly.value) {
    const validXpk = await xpkRules.value.$validate();
    if (!validXpk) return;
  } else {
    const validMnemonic = await mnemonicRules.value.$validate();
    if (!validMnemonic) return;
  }

  try {
    loading.value = true;

    const walletId = isReadonly.value
      ? await app.putWallet({
          name: walletName.value,
          type: WalletType.ReadOnly,
          extendedPublicKey: xpk.value
        })
      : await app.putWallet({
          name: walletName.value,
          type: WalletType.Standard,
          mnemonic: mnemonicWords.value.join(" "),
          password: password.value
        });

    await wallet.load(walletId, { syncInBackground: false });
    router.push({ name: "assets" });
  } catch (e) {
    toast({
      title: "Error importing wallet",
      variant: "destructive",
      description: extractErrorMessage(e)
    });

    log.error(e);
    return;
  } finally {
    loading.value = false;
  }
}

function onPaste(event: ClipboardEvent) {
  if (step.value !== 2 || isReadonly.value) return;

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

const steps = computed<Step[]>(() => [
  {
    step: 1,
    title: "Basic info",
    description: "This information will be used to identify and protect your wallet.",
    icon: FingerprintIcon,
    enabled: ref(true)
  },
  {
    step: 2,
    title: isReadonly.value ? "Wallet key" : "Wallet secret",
    description: isReadonly.value
      ? "Insert the Extended Public Key of your wallet."
      : "Select the type of secret you want to use and fill it out.",
    icon: KeyRoundIcon,
    enabled: computed(() => !infoRules.value.$invalid)
  }
]);
</script>

<template>
  <Stepper v-model="step" :steps="steps" />

  <div class="flex h-full flex-col gap-6 p-6 pt-4">
    <StepTitle :step="steps[step - 1]" />

    <Form class="flex h-full grow flex-col justify-start gap-4" @paste="onPaste" @submit="next">
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

        <FormField>
          <Label for="wallet-type">Wallet type</Label>
          <Select v-model="walletType">
            <SelectTrigger id="wallet-type">
              <SelectValue placeholder="Select a fruit" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="readonly">Read-only</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </FormField>

        <FormField :validation="infoRules.password">
          <Label :disabled="isReadonly" for="password">Spending password</Label>
          <PasswordInput
            id="password"
            v-model="password"
            :disabled="loading || isReadonly"
            type="password"
            @blur="infoRules.password.$touch()"
          />
        </FormField>
        <FormField :validation="infoRules.confirmPassword">
          <Label :disabled="isReadonly" for="confirm-password">Confirm password</Label>
          <PasswordInput
            id="confirm-password"
            v-model="confirmPassword"
            :disabled="loading || isReadonly"
            type="password"
            @blur="infoRules.confirmPassword.$touch()"
          />
        </FormField>
      </template>

      <template v-else-if="step === 2">
        <template v-if="isReadonly">
          <FormField :validation="xpkRules.xpk">
            <Label for="xpk">Extended public key</Label>
            <Textarea id="xpk" v-model="xpk" class="h-40" @blur="xpkRules.xpk.$touch()" />
          </FormField>
        </template>

        <template v-else>
          <FormField>
            <Select v-model="wordsCountStr">
              <SelectTrigger>
                <SelectValue class="font-medium" placeholder="Select the secret type" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem v-for="l in SUPPORTED_MNEMONIC_LENGTHS" :key="l" :value="l.toString()"
                    >{{ l }} words recovery phrase</SelectItem
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

    <div class="flex flex-row gap-4">
      <Button :disabled="loading" class="w-full items-center" @click="next">
        <template v-if="loading"><Loader2Icon class="animate-spin" />Importing wallet...</template>
        <template v-else>{{ nextButtonTitle }}</template>
      </Button>
    </div>
  </div>
</template>
