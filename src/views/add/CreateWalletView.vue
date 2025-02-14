<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { generateMnemonic } from "@fleet-sdk/wallet";
import { useVuelidate } from "@vuelidate/core";
import { helpers, minLength, required, sameAs } from "@vuelidate/validators";
import { FingerprintIcon, KeyRoundIcon, Loader2Icon, RotateCwIcon } from "lucide-vue-next";
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

const walletName = ref("");
const password = ref("");
const confirmPassword = ref("");
const mnemonicPhrase = ref("");
const loading = ref(false);
const step = ref(1);
const strength = ref(DEFAULT_WALLET_STRENGTH);

const v$ = useVuelidate(
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

const mnemonicWords = computed(() => mnemonicPhrase.value.split(" "));
const nexButtonTitle = computed(() =>
  step.value === 1 ? "Create a recovery phrase" : "I've saved these words"
);

onMounted(newMnemonic);

watch(strength, newMnemonic);

async function next() {
  if (step.value === 1) {
    const valid = await v$.value.$validate();
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
    enabled: computed(() => !v$.value.$invalid)
  }
];
</script>

<template>
  <DefaultStepper v-model="step" :steps="steps" class="py-2" />

  <div class="flex h-full flex-col gap-6 p-6 pt-4">
    <Form class="flex h-full flex-grow flex-col justify-start gap-4" @submit="next">
      <template v-if="step === 1">
        <FormField :validation="v$.walletName">
          <Label for="wallet-name">Wallet name</Label>
          <Input
            id="wallet-name"
            v-model="walletName"
            :disabled="loading"
            maxlength="50"
            type="text"
            @blur="v$.walletName.$touch()"
          />
        </FormField>

        <Separator class="my-2" />

        <FormField :validation="v$.password">
          <Label for="password">Spending password</Label>
          <PasswordInput
            id="password"
            v-model="password"
            :disabled="loading"
            type="password"
            @blur="v$.password.$touch()"
          />
        </FormField>
        <FormField :validation="v$.confirmPassword">
          <Label for="confirm-password">Confirm password</Label>
          <PasswordInput
            id="confirm-password"
            v-model="confirmPassword"
            :disabled="loading"
            type="password"
            @blur="v$.confirmPassword.$touch()"
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
            class="right-4 top-4"
          />
        </Tabs>

        <Mnemonic :words="mnemonicWords" />
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
