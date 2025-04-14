<script setup lang="ts">
import { computed, ref, useTemplateRef } from "vue";
import WebUSBTransport from "@ledgerhq/hw-transport-webusb";
import { DeviceError, ErgoLedgerApp, Network, RETURN_CODE } from "ledger-ergo-js";
import { useI18n } from "vue-i18n";
import { StateAddress } from "@/stores/walletStore";
import LedgerDevice from "@/components/LedgerDevice.vue";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from "@/components/ui/drawer";
import { useToast } from "@/components/ui/toast";
import { StateCallback } from "@/chains/ergo/transaction/prover";
import { log } from "@/common/logger";
import { extractErrorMessage } from "@/common/utils";
import { DERIVATION_PATH, MAINNET } from "@/constants/ergo";

const emit = defineEmits(["accepted", "refused", "close"]);
const props = defineProps<{ address: StateAddress }>();

const opened = ref(true);
const loading = ref(false);
const ledgerDevice = useTemplateRef("ledger-device");
const { toast } = useToast();
const { t } = useI18n();

const path = computed(() => DERIVATION_PATH + `/${props.address.index}`);

async function verify() {
  loading.value = true;
  const setState = ledgerDevice.value?.setState as StateCallback;

  try {
    const ready = await ledgerDevice.value?.openErgoApp();
    if (!ready) return;

    setState({ busy: true });
    const app = new ErgoLedgerApp(await WebUSBTransport.create()).useAuthToken();

    setState({
      type: undefined,
      label: t("address.verify.confirmOnDevice"),
      appId: app.authToken
    });
    const network = MAINNET ? Network.Mainnet : Network.Testnet;
    const confirmed = await app.showAddress(path.value, network);

    if (confirmed) {
      setState({ type: "success", label: t("common.confirmed") });
      emit("accepted");
    } else {
      setState({ type: "error", label: t("address.verify.notConfirmed") });
      emit("refused");
    }
  } catch (e) {
    if (e instanceof DeviceError) {
      if (e.code === RETURN_CODE.DENIED || e.code === RETURN_CODE.GLOBAL_ACTION_REFUSED) {
        setState({ type: "error", label: t("address.verify.notConfirmed") });
        emit("refused");
        return;
      } else if (
        e.code === RETURN_CODE.GLOBAL_LOCKED_DEVICE ||
        e.code === RETURN_CODE.GLOBAL_PIN_NOT_SET
      ) {
        ledgerDevice.value?.setState({ label: t("device.isLocked"), type: "locked" });
        return;
      }
    }

    toast({
      title: t("address.verify.verificationError"),
      description: extractErrorMessage(e, t("address.verify.unknownVerificationError"))
    });

    log.error(e);
  } finally {
    loading.value = false;
    setState({ busy: false });
  }
}

function handleOpenUpdates(open: boolean) {
  if (!open) emit("close");
}

function setOpened(open: boolean) {
  opened.value = open;
}

defineExpose({ open: () => setOpened(true), close: () => setOpened(false) });
</script>

<template>
  <Drawer v-model:open="opened" :dismissible="!loading" @update:open="handleOpenUpdates">
    <DrawerContent :dismissible="!loading">
      <DrawerHeader v-once>
        <DrawerTitle>{{ t("address.verify.title") }}</DrawerTitle>
        <DrawerDescription>{{ t("address.verify.description") }} </DrawerDescription>
      </DrawerHeader>

      <Alert v-once>
        <AlertTitle>{{ t("address.label.address") }}</AlertTitle>
        <AlertDescription class="break-all">{{ address.script }}</AlertDescription>
      </Alert>

      <Alert v-once>
        <AlertTitle>{{ t("address.label.path") }}</AlertTitle>
        <AlertDescription class="break-all">{{ path }}</AlertDescription>
      </Alert>

      <LedgerDevice ref="ledger-device" />

      <DrawerFooter class="flex flex-row gap-4" v-once>
        <DrawerClose as-child>
          <Button class="w-full" variant="outline" :disabled="loading">{{
            t("common.close")
          }}</Button>
        </DrawerClose>
        <Button class="w-full" type="submit" :disabled="loading" @click="verify">{{
          t("common.verify")
        }}</Button>
      </DrawerFooter>
    </DrawerContent>
  </Drawer>
</template>
