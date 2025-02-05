<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import WebUSBTransport from "@ledgerhq/hw-transport-webusb";
import { DeviceError, ErgoLedgerApp, Network, RETURN_CODE } from "ledger-ergo-js";
import { StateAddress } from "@/stores/walletStore";
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
import { LedgerDeviceModelId, ProverStateType } from "@/chains/ergo/transaction/prover";
import { log } from "@/common/logger";
import { DERIVATION_PATH, MAINNET } from "@/constants/ergo";
import LedgerDevice from "../LedgerDevice.vue";

const emit = defineEmits(["accepted", "denied", "close"]);
const props = defineProps<{ address: StateAddress }>();

const opened = ref(true);

const state = reactive({
  connected: false,
  loading: false,
  caption: "",
  screenContent: "",
  state: undefined as ProverStateType | undefined,
  model: "nanoX" as LedgerDeviceModelId,
  appId: 0
});

const path = computed(() => DERIVATION_PATH + `/${props.address.index}`);

async function confirmAddress() {
  state.loading = true;
  state.state = undefined;
  state.screenContent = "Connecting...";
  let app!: ErgoLedgerApp;

  try {
    app = new ErgoLedgerApp(await WebUSBTransport.create()).useAuthToken();
    state.appId = app.authToken ?? 0;
    state.model = app.device.transport.deviceModel?.id.toString() as LedgerDeviceModelId;

    const appInfo = await app.getAppName();
    if (appInfo.name !== "Ergo") {
      state.state = "error";
      state.loading = false;
      state.caption = "Ergo App is not opened.";
      app.device.transport.close();

      return;
    }

    state.connected = true;
  } catch (e) {
    state.state = "error";
    state.loading = false;
    state.caption = "";
    log.error(e);

    return;
  }

  try {
    state.screenContent = "Confirm Address";
    state.caption = "";

    const network = MAINNET ? Network.Mainnet : Network.Testnet;
    const confirmed = await app.showAddress(path.value, network);
    if (confirmed) {
      state.state = "success";
      state.screenContent = "Confirmed";
      emit("accepted");
    } else {
      state.state = "error";
      state.screenContent = "Not confirmed";
      emit("denied");
    }
  } catch (e) {
    state.loading = false;
    state.state = "error";
    log.error(e);

    if (e instanceof DeviceError) {
      switch (e.code) {
        case RETURN_CODE.DENIED:
          state.screenContent = "Not confirmed";
          emit("denied");
          break;
        case RETURN_CODE.INTERNAL_CRYPTO_ERROR:
          state.caption =
            "It looks like your device is locked. Make sure it is unlocked before proceeding.";
          break;
        default:
          state.caption = `[Device error] ${e.message}`;
      }
    } else {
      state.caption = `[Unknown error] ${e instanceof Error ? e.message : e}`;
    }

    return;
  } finally {
    app.device.transport.close();
    state.loading = false;
    state.connected = false;
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
  <Drawer v-model:open="opened" @update:open="handleOpenUpdates">
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>Address Verification</DrawerTitle>
        <DrawerDescription>
          Ensure that the displayed <span class="font-semibold">address</span> and
          <span class="font-semibold">path</span> match exactly what appears on your device. Then
          press <span class="font-semibold">Approve</span> to confirm.
        </DrawerDescription>
      </DrawerHeader>

      <LedgerDevice ref="ledger-device" />

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

      <DrawerFooter>
        <DrawerClose class="flex flex-row gap-4">
          <Button class="w-full" variant="outline">Close</Button>
          <Button class="w-full" type="submit">Verify</Button>
        </DrawerClose>
      </DrawerFooter>
    </DrawerContent>
  </Drawer>
</template>
