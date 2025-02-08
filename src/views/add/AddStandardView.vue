<script setup lang="ts">
import { onMounted, ref } from "vue";
import { generateMnemonic } from "@fleet-sdk/wallet";
import { useVuelidate } from "@vuelidate/core";
import { helpers, minLength, required, sameAs } from "@vuelidate/validators";
import { CheckIcon, FingerprintIcon, KeyRoundIcon } from "lucide-vue-next";
import { useRouter } from "vue-router";
import { useAppStore } from "@/stores/appStore";
import { useWalletStore } from "@/stores/walletStore";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Form, FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { DefaultStepper, Step } from "@/components/ui/stepper";
import { log } from "@/common/logger";
import { DEFAULT_WALLET_STRENGTH } from "@/constants/ergo";
import { WalletType } from "@/types/internal";

// import DefaultStepper from "./DefaultStepper.vue";

const app = useAppStore();
const wallet = useWalletStore();
const router = useRouter();

const walletName = ref("");
const password = ref("");
const confirmPassword = ref("");
const mnemonic = ref("");
const mnemonicStoreAgreement = ref(false);
const loading = ref(false);

const v$ = useVuelidate(
  {
    walletName: { required: helpers.withMessage("Wallet name is required.", required) },
    password: {
      required: helpers.withMessage("Spending password is required.", required),
      minLenght: helpers.withMessage(
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

onMounted(() => {
  mnemonic.value = generateMnemonic(DEFAULT_WALLET_STRENGTH);
});

async function add() {
  const valid = await v$.value.$validate();
  if (!valid) return;

  loading.value = true;
  try {
    const walletId = await app.putWallet({
      name: walletName.value,
      mnemonic: mnemonic.value,
      password: password.value,
      type: WalletType.Standard
    });

    await wallet.load(walletId, { syncInBackground: false });
  } catch (e) {
    log.error(e);
    loading.value = false;
    return;
  }

  router.push({ name: "assets" });
}

const steps: Step[] = [
  {
    step: 1,
    title: "Info",
    icon: FingerprintIcon
  },
  {
    step: 2,
    title: "Secret",
    icon: KeyRoundIcon
  },
  {
    step: 3,
    title: "Done",
    icon: CheckIcon
  }
  // {
  //   step: 4,
  //   title: "Verification",
  //   icon: ShieldCheckIcon
  // }
];

const index = ref(1);
</script>

<template>
  <div class="flex h-full flex-col gap-6 p-6">
    <DefaultStepper v-model="index" :steps="steps" />

    <Form class="flex flex-grow flex-col gap-6 h-full justify-center" @submit="add">
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

      <Separator />

      <!-- <div class="flex flex-row gap-4"> -->
      <FormField :validation="v$.password">
        <Label for="password">Spending password</Label>
        <Input
          id="password"
          v-model="password"
          :disabled="loading"
          type="password"
          @blur="v$.password.$touch()"
        />
      </FormField>
      <FormField :validation="v$.confirmPassword">
        <Label for="confirm-password">Confirm password</Label>
        <Input
          id="confirm-password"
          v-model="confirmPassword"
          :disabled="loading"
          type="password"
          @blur="v$.confirmPassword.$touch()"
        />
      </FormField>
      <!-- </div> -->
      <!-- <FormField>
        <Label>Recovery phrase</Label>
        <Alert class="text-base text-justify">
          {{ mnemonic }}
        </Alert>
      </FormField>
      <label
        class="mb-2 inline-flex w-full cursor-pointer items-center rounded border border-yellow-300 bg-yellow-100 px-3 py-1 font-normal"
      >
        <input v-model="mnemonicStoreAgreement" class="checkbox" type="checkbox" />
        <span class="text-yellow-900">I've stored the secret phrase in a secure place.</span>
      </label> -->
    </Form>

    <div class="flex flex-row gap-4">
      <Button
        class="w-full"
        size="lg"
        :disabled="loading || !mnemonicStoreAgreement"
        @click="add()"
      >
        Next
      </Button>
    </div>
  </div>
</template>
