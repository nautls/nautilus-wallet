<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive } from "vue";
import TransportWebUSB from "@ledgerhq/hw-transport-webusb";
import { DeviceError, ErgoLedgerApp, RETURN_CODE } from "ledger-ergo-js";
import {
  CheckCheckIcon,
  CheckIcon,
  CircleAlertIcon,
  Loader2Icon,
  LockIcon,
  XIcon
} from "lucide-vue-next";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import LedgerNanoS from "@/assets/images/hw-devices/ledger-nanosp.svg?skipsvgo";
import LedgerNanoX from "@/assets/images/hw-devices/ledger-nanox.svg?skipsvgo";
import { ProverState } from "@/chains/ergo/transaction/prover";
import { extractErrorMessage, sleep } from "@/common/utils";

const LEDGER_VENDOR_ID = 0x2c97; // https://github.com/LedgerHQ/ledger-live/blob/22714d2324898b853332363f2a522d72bbed0d3a/libs/ledgerjs/packages/devices/src/index.ts#L141

interface DeviceConnectionEvent {
  device?: USBDevice;
}

interface Props {
  initialState?: ProverState;
}

const props = withDefaults(defineProps<Props>(), {
  initialState: () => ({
    model: "nanoSP",
    state: undefined,
    screenText: undefined,
    appId: undefined,
    connected: false
  })
});

const state = reactive<ProverState>({
  connected: props.initialState.connected,
  type: props.initialState.type,
  label: props.initialState.label
});

const { toast } = useToast();

onMounted(async () => {
  navigator.usb.addEventListener("connect", onDeviceConnect);
  navigator.usb.addEventListener("disconnect", onDeviceDisconnect);

  const devices = await navigator.usb.getDevices();
  onDeviceConnect({ device: devices.find((x) => x.vendorId === LEDGER_VENDOR_ID) });
});

onBeforeUnmount(() => {
  navigator.usb.removeEventListener("connect", onDeviceConnect);
  navigator.usb.removeEventListener("disconnect", onDeviceDisconnect);
});

const appIdHex = computed(() => (!state.appId ? undefined : `0x${state.appId.toString(16)}`));
const isNanoX = computed(() => state.model === "nanoX");
const screenPosition = computed(() =>
  isNanoX.value ? "top-[12px] left-[57px]" : "top-[15px] left-[32px]"
);

async function onDeviceConnect({ device }: DeviceConnectionEvent) {
  if (state.connected || state.busy || !device || device.vendorId !== LEDGER_VENDOR_ID) return;

  try {
    const app = new ErgoLedgerApp(await TransportWebUSB.create());

    setState({
      model: app.device.transport.deviceModel?.id,
      connected: true,
      label: "Connected",
      type: "ready"
    });

    const appInfo = await app.device.getCurrentAppInfo();
    if (appInfo.name === "Ergo") {
      setState({ label: "Ready", type: "ready" });
    }
  } catch (e) {
    if (
      e instanceof DeviceError &&
      (e.code === RETURN_CODE.GLOBAL_LOCKED_DEVICE || e.code === RETURN_CODE.GLOBAL_PIN_NOT_SET)
    ) {
      setState({ label: "Device is locked", type: "locked" });
      return;
    }

    setState({
      type: "error",
      label: "Connection error",
      additionalInfo: extractErrorMessage(e)
    });
  }
}

function onDeviceDisconnect({ device }: DeviceConnectionEvent) {
  if (!device || state.busy || device.vendorId !== LEDGER_VENDOR_ID) return;

  if (state.connected) {
    setState({ connected: false, label: "Reconnecting...", appId: undefined, type: "loading" });
  } else {
    setState({ connected: false, label: undefined, type: undefined });
  }
}

async function openErgoApp(): Promise<boolean> {
  try {
    const app = new ErgoLedgerApp(await TransportWebUSB.create());

    const currentApp = await app.device.getCurrentAppInfo();
    if (currentApp.name !== "Ergo") {
      setState({ busy: true, connected: true });

      if (currentApp.name !== "BOLOS") {
        await app.device.closeApp();
        setState({ type: "loading", label: "Waiting for the app to be closed" });
        await sleep(1000); // Wait for the app to be fully closed
      }

      setState({ type: undefined, label: "Confirm opening the Ergo app" });
      // device.closeApp() command disconnects the device for some reason,
      // so we need to create a new instance to re-open it
      await new ErgoLedgerApp(await TransportWebUSB.create()).device.openApp("Ergo");
      setState({ type: "loading", label: "Waiting for the app to be ready" });
      await sleep(1000); // Wait for the app to be fully opened
    }

    setState({ type: "ready", label: "Ready" });
    return true;
  } catch (e) {
    if (e instanceof DeviceError) {
      if (
        e.code === RETURN_CODE.GLOBAL_LOCKED_DEVICE ||
        e.code === RETURN_CODE.GLOBAL_PIN_NOT_SET
      ) {
        setState({ type: "locked", label: "Device is locked" });
        return false;
      } else if (e.code === RETURN_CODE.GLOBAL_ACTION_REFUSED) {
        setState({ type: "error", label: "Ergo app opening denied by the user" });
        return false;
      }
    }

    setState({
      type: "error",
      label: "Error opening the Ergo app",
      additionalInfo: extractErrorMessage(e)
    });

    return false;
  } finally {
    setState({ busy: false });
  }
}

function setState(newState: ProverState) {
  if (newState.type === "error" && newState.additionalInfo) {
    toast({
      variant: "destructive",
      title: newState.label,
      description: newState.additionalInfo
    });
  }

  Object.assign(state, newState);
}

defineExpose({ setState, openErgoApp });
</script>

<template>
  <div class="mx-auto flex flex-col items-center gap-2 h-min">
    <div v-if="state.connected || state.type" class="mx-auto text-center text-sm w-[240px]">
      <div class="relative">
        <LedgerNanoX v-if="isNanoX" />
        <LedgerNanoS v-else />

        <div
          :class="screenPosition"
          class="absolute w-[111px] h-[51px] flex flex-col items-center justify-around gap-1 leading-none p-0.5 text-xs text-slate-100 bg-blue-50/0 transition-all"
        >
          <CheckCheckIcon v-if="state.type === 'ready'" class="size-auto opacity-80" />
          <Loader2Icon
            v-else-if="state.type === 'loading'"
            class="size-auto animate-spin opacity-80"
          />
          <CheckIcon
            v-else-if="state.type === 'success'"
            class="size-auto text-green-400 opacity-80"
          />
          <XIcon v-else-if="state.type === 'error'" class="size-auto text-red-400 opacity-80" />
          <LockIcon v-else-if="state.type === 'locked'" class="size-auto opacity-80" />

          <p v-if="state.label" class="font-semibold opacity-90 text-[0.70rem]">
            {{ state.label }}
          </p>
          <small v-if="state.appId" class="flex-shrink opacity-70">App ID: {{ appIdHex }}</small>
        </div>
      </div>
    </div>

    <Alert v-else class="space-x-2">
      <CircleAlertIcon />
      <AlertTitle>Device not found!</AlertTitle>
      <AlertDescription> Ensure your device is properly connected and unlocked. </AlertDescription>
    </Alert>
  </div>
</template>
