<script setup lang="ts">
import { computed, ref, useTemplateRef } from "vue";
import WebUSBTransport from "@ledgerhq/hw-transport-webusb";
import { DeviceError, ErgoLedgerApp, Network, RETURN_CODE } from "ledger-ergo-js";
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

const path = computed(() => DERIVATION_PATH + `/${props.address.index}`);

async function verify() {
  loading.value = true;
  const setState = ledgerDevice.value?.setState as StateCallback;

  try {
    const ready = await ledgerDevice.value?.openErgoApp();
    if (!ready) return;

    setState({ busy: true });
    const app = new ErgoLedgerApp(await WebUSBTransport.create()).useAuthToken();

    setState({ type: undefined, label: "Confirm address on your device", appId: app.authToken });
    const network = MAINNET ? Network.Mainnet : Network.Testnet;
    const confirmed = await app.showAddress(path.value, network);

    if (confirmed) {
      setState({ type: "success", label: "Confirmed" });
      emit("accepted");
    } else {
      setState({ type: "error", label: "Not confirmed" });
      emit("refused");
    }
  } catch (e) {
    if (e instanceof DeviceError) {
      if (e.code === RETURN_CODE.DENIED || e.code === RETURN_CODE.GLOBAL_ACTION_REFUSED) {
        setState({ type: "error", label: "Not confirmed" });
        emit("refused");
        return;
      } else if (
        e.code === RETURN_CODE.GLOBAL_LOCKED_DEVICE ||
        e.code === RETURN_CODE.GLOBAL_PIN_NOT_SET
      ) {
        ledgerDevice.value?.setState({ label: "Device is locked", type: "locked" });
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
      <DrawerHeader>
        <DrawerTitle>Address Verification</DrawerTitle>
        <DrawerDescription>
          Ensure that the displayed <span class="font-semibold">address</span> and
          <span class="font-semibold">path</span> match exactly what appears on your device.
        </DrawerDescription>
      </DrawerHeader>

      <Alert>
        <AlertTitle>Address</AlertTitle>
        <AlertDescription class="break-all">
          {{ address.script }}
        </AlertDescription>
      </Alert>

      <Alert>
        <AlertTitle>Path</AlertTitle>
        <AlertDescription class="break-all">
          {{ path }}
        </AlertDescription>
      </Alert>

      <LedgerDevice ref="ledger-device" />

      <DrawerFooter class="flex flex-row gap-4">
        <DrawerClose as-child>
          <Button class="w-full" variant="outline" :disabled="loading">Close</Button>
        </DrawerClose>
        <Button class="w-full" type="submit" :disabled="loading" @click="verify">Verify</Button>
      </DrawerFooter>
    </DrawerContent>
  </Drawer>
</template>
