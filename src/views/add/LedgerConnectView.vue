<script setup lang="ts">
import { ref, useTemplateRef } from "vue";
import { hex } from "@fleet-sdk/crypto";
import WebUSBTransport from "@ledgerhq/hw-transport-webusb";
import { useVuelidate } from "@vuelidate/core";
import { helpers, required } from "@vuelidate/validators";
import { DeviceError, ErgoLedgerApp, RETURN_CODE } from "ledger-ergo-js";
import { Loader2Icon } from "lucide-vue-next";
import { useRouter } from "vue-router";
import { useAppStore } from "@/stores/appStore";
import { useWalletStore } from "@/stores/walletStore";
import LedgerDevice from "@/components/LedgerDevice.vue";
import { Button } from "@/components/ui/button";
import { Form, FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import HdKey from "@/chains/ergo/hdKey";
import { StateCallback } from "@/chains/ergo/transaction/prover";
import { log } from "@/common/logger";
import { extractErrorMessage } from "@/common/utils";
import { WalletType } from "@/types/internal";

const app = useAppStore();
const wallet = useWalletStore();
const router = useRouter();
const { toast } = useToast();

const walletName = ref("");
const loading = ref(false);
const ledgerDevice = useTemplateRef("ledger-device");

const v$ = useVuelidate(
  { walletName: { required: helpers.withMessage("Wallet name is required.", required) } },
  { walletName }
);

async function add() {
  const valid = await v$.value.$validate();
  if (!valid) return;

  loading.value = true;
  const setState = ledgerDevice.value?.setState as StateCallback;

  try {
    const ready = await ledgerDevice.value?.openErgoApp();
    if (!ready) return;

    setState({ busy: true });
    const ledgerApp = new ErgoLedgerApp(await WebUSBTransport.create()).useAuthToken();

    setState({
      type: undefined,
      label: "Confirm export Extended Public Key",
      appId: ledgerApp.authToken
    });

    const ledgerXpk = await ledgerApp.getExtendedPublicKey("m/44'/429'/0'");
    if (!ledgerXpk) {
      setState({ type: "error", label: "Not exported" });
      return;
    }

    setState({ type: "success", label: "Confirmed" });

    const extendedPublicKey = hex.encode(HdKey.fromPublicKey(ledgerXpk, "m/0").extendedPublicKey);
    const walletId = await app.putWallet({
      type: WalletType.Ledger,
      name: walletName.value,
      extendedPublicKey
    });
    await wallet.load(walletId, { syncInBackground: false });
    router.push({ name: "assets" });
  } catch (e) {
    if (e instanceof DeviceError) {
      if (e.code === RETURN_CODE.DENIED || e.code === RETURN_CODE.GLOBAL_ACTION_REFUSED) {
        setState({ type: "error", label: "Denied by the user", appId: undefined });
        return;
      } else if (
        e.code === RETURN_CODE.GLOBAL_LOCKED_DEVICE ||
        e.code === RETURN_CODE.GLOBAL_PIN_NOT_SET
      ) {
        ledgerDevice.value?.setState({
          label: "Device is locked",
          type: "locked",
          appId: undefined
        });
        return;
      }
    }

    toast({
      title: "Verification failed",
      description: extractErrorMessage(e, "An unknown error occurred while verifying the address.")
    });

    log.error(e);
  } finally {
    loading.value = false;
    setState({ busy: false });
  }
}
</script>

<template>
  <div class="flex h-full flex-col justify-between gap-6 p-6">
    <Form class="flex flex-col justify-start gap-4" @submit="add">
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
    </Form>

    <LedgerDevice ref="ledger-device" />

    <Button :disabled="loading" type="button" class="w-full" @click="add">
      <template v-if="loading"><Loader2Icon class="animate-spin" />Connecting...</template>
      <template v-else>Connect</template>
    </Button>
  </div>
</template>
