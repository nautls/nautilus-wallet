<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef } from "vue";
import { hex } from "@fleet-sdk/crypto";
import WebUSBTransport from "@ledgerhq/hw-transport-webusb";
import { useVuelidate } from "@vuelidate/core";
import { helpers, required } from "@vuelidate/validators";
import { DeviceError, ErgoLedgerApp, RETURN_CODE } from "ledger-ergo-js";
import { Loader2Icon } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import { useAppStore } from "@/stores/appStore";
import { useWalletStore } from "@/stores/walletStore";
import LedgerDevice from "@/components/LedgerDevice.vue";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Form, FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import HdKey from "@/chains/ergo/hdKey";
import { StateCallback } from "@/chains/ergo/transaction/prover";
import { browser } from "@/common/browser";
import { log } from "@/common/logger";
import { extractErrorMessage } from "@/common/utils";
import { WalletType } from "@/types/internal";

const app = useAppStore();
const wallet = useWalletStore();
const { toast } = useToast();
const { t } = useI18n();

const walletName = ref("");
const loading = ref(false);
const connected = ref(false);
const ledgerDevice = useTemplateRef("ledger-device");

const formattedViewMode = computed(() => {
  return app.settings.extension.viewMode === "popup"
    ? t("wallet.connect.popupViewMode")
    : t("wallet.connect.sidePanelViewMode");
});

onMounted(() => {
  app.viewTitle = t("wallet.index.connect");
});

async function switchToViewMode() {
  if (!browser) return;

  if (app.settings.extension.viewMode === "popup") {
    window.close();
    chrome.action.openPopup();
  } else {
    const currentWindow = await browser.windows.getCurrent();
    if (currentWindow?.id) {
      window.close();
      chrome.sidePanel.open({ windowId: currentWindow.id });
    }
  }
}

const v$ = useVuelidate(
  { walletName: { required: helpers.withMessage(t("wallet.requiredWalletName"), required) } },
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
      label: t("wallet.connect.confirmXPubExport"),
      appId: ledgerApp.authToken
    });

    const ledgerXpk = await ledgerApp.getExtendedPublicKey("m/44'/429'/0'");
    if (!ledgerXpk) {
      setState({ type: "error", label: t("wallet.connect.notExported") });
      return;
    }

    setState({ type: "success", label: t("common.confirmed") });

    const extendedPublicKey = hex.encode(HdKey.fromPublicKey(ledgerXpk, "m/0").extendedPublicKey);
    const walletId = await app.putWallet({
      type: WalletType.Ledger,
      name: walletName.value,
      extendedPublicKey
    });
    await wallet.load(walletId, { syncInBackground: false });
    connected.value = true;
  } catch (e) {
    if (e instanceof DeviceError) {
      if (e.code === RETURN_CODE.DENIED || e.code === RETURN_CODE.GLOBAL_ACTION_REFUSED) {
        setState({ type: "error", label: t("device.ledger.deniedByUser"), appId: undefined });
        return;
      } else if (
        e.code === RETURN_CODE.GLOBAL_LOCKED_DEVICE ||
        e.code === RETURN_CODE.GLOBAL_PIN_NOT_SET
      ) {
        ledgerDevice.value?.setState({
          label: t("device.isLocked"),
          type: "locked",
          appId: undefined
        });
        return;
      }
    }

    toast({
      title: t("wallet.connect.verificationError"),
      description: extractErrorMessage(e, t("wallet.connect.verificationUnknownError"))
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
        <Label for="wallet-name">{{ t("wallet.walletName") }}</Label>
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
      <template v-if="loading"
        ><Loader2Icon class="animate-spin" />{{ t("device.connecting") }}</template
      >
      <template v-else>{{ t("device.connect") }}</template>
    </Button>
  </div>

  <AlertDialog :open="connected">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t("wallet.connect.success") }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ t("wallet.connect.successDesc", { viewMode: formattedViewMode }) }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogAction class="w-full" @click="switchToViewMode"
          >{{ t("wallet.connect.openInViewMode", { viewMode: formattedViewMode }) }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
