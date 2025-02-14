<script setup lang="ts">
import { computed, ref, watch } from "vue";
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
import { Separator } from "@/components/ui/separator";
import { DefaultStepper, Step } from "@/components/ui/stepper";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { Mnemonic } from "@/components/wallet";
import { log } from "@/common/logger";
import { extractErrorMessage } from "@/common/utils";
import { WalletType } from "@/types/internal";
import { validMnemonic, validPublicKey } from "@/validators";

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
const wordsCount = ref(15);
const walletType = ref<"standard" | "readonly">("standard");

const xpk = ref("");

// onPaste(event: ClipboardEvent) {
//   const pasteData = event.clipboardData?.getData("text");
//   if (!pasteData) {
//     return;
//   }

//   const pasteWords = pasteData.split(" ");
//   if (isEmpty(pasteWords)) {
//     return;
//   }

//   const intersec = intersection(english, pasteWords);

//   if (intersec.length == pasteWords.length) {
//     // need to paste from pasteWords since intersect doesn't guarantees the order os elements
//     this.selectedWords = pasteWords;
//   }
// }

const mnemonicPhrase = computed(() => mnemonicWords.value.join(" "));
const isReadonly = computed(() => walletType.value === "readonly");
const nexButtonTitle = computed(() => {
  if (step.value === 1) {
    return isReadonly.value ? "Insert a public key" : "Insert a recovery phrase";
  } else {
    return "Import wallet";
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
      validMnemonic: validMnemonic
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

  if (step.value < steps.length) {
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
  }
];
</script>

<template>
  <DefaultStepper v-model="step" :steps="steps" class="py-2" />

  <div class="flex h-full flex-col gap-6 p-6 pt-4">
    <Form class="flex h-full flex-grow flex-col justify-start gap-4" @submit="next">
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
          <Select v-model="walletType">
            <Label for="wallet-type">Wallet type</Label>
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

        <Separator class="my-2" />

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
            <template #description>
              Paste your extended public key here. This key allows viewing transaction history and
              generating new addresses, but it cannot spend or move funds in any way.
            </template>
          </FormField>
        </template>

        <template v-else>
          <Tabs v-model="wordsCount" class="flex w-full items-center gap-0">
            <TabsList class="flex">
              <TabsTrigger class="w-full" :value="15">15 words</TabsTrigger>
              <TabsTrigger class="w-full" :value="24">24 words</TabsTrigger>
            </TabsList>
            <!-- <div class="grow"></div>
            <Button type="button" variant="ghost" size="icon">
              <RotateCwIcon />
            </Button>
            <CopyButton
              type="button"
              variant="ghost"
              size="icon"
              :content="mnemonicWords"
              class="right-4 top-4"
            /> -->
          </Tabs>

          <Mnemonic :words="mnemonicWords" editable />
          <!-- {{ mnemonicWords }} -->
        </template>
      </template>
    </Form>

    <div class="flex flex-row gap-4">
      <Button :disabled="loading" class="w-full items-center" size="lg" @click="next">
        <template v-if="loading"><Loader2Icon class="animate-spin" />Creating wallet...</template>
        <template v-else>{{ nexButtonTitle }}</template>
      </Button>
    </div>
  </div>
</template>
