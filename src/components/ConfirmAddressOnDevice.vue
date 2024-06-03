<script setup lang="ts">
import WebUSBTransport from "@ledgerhq/hw-transport-webusb";
import { DeviceError, ErgoLedgerApp, Network, RETURN_CODE } from "ledger-ergo-js";
import { computed, onMounted, reactive } from "vue";
import { DERIVATION_PATH, MAINNET } from "../constants/ergo";
import { log } from "@/common/logger";
import { LedgerDeviceModelId } from "@/constants/ledger";
import { ProverStateType } from "@/types/internal";

const emits = defineEmits(["accepted", "denied"]);
const props = defineProps({
  address: { type: String, required: true },
  index: { type: Number, required: true }
});

const state = reactive({
  connected: false,
  loading: false,
  caption: "",
  screenContent: "",
  state: undefined as ProverStateType | undefined,
  model: LedgerDeviceModelId.nanoX,
  appId: 0
});

const path = computed(() => DERIVATION_PATH + `/${props.index}`);

onMounted(confirmAddress);

async function confirmAddress() {
  state.loading = true;
  state.state = undefined;
  state.screenContent = "Connecting...";
  let app!: ErgoLedgerApp;

  try {
    app = new ErgoLedgerApp(await WebUSBTransport.create()).useAuthToken().enableDebugMode();
    state.appId = app.authToken ?? 0;
    state.model =
      (app.transport.deviceModel?.id.toString() as LedgerDeviceModelId) ??
      LedgerDeviceModelId.nanoX;

    const appInfo = await app.getAppName();
    if (appInfo.name !== "Ergo") {
      state.state = ProverStateType.error;
      state.loading = false;
      state.caption = "Ergo App is not opened.";
      app.transport.close();

      return;
    }

    state.connected = true;
  } catch (e) {
    state.state = ProverStateType.unavailable;
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
      state.state = ProverStateType.success;
      state.screenContent = "Confirmed";
      emits("accepted");
    } else {
      state.state = ProverStateType.error;
      state.screenContent = "Not confirmed";
      emits("denied");
    }
  } catch (e) {
    state.loading = false;
    state.state = ProverStateType.error;
    log.error(e);

    if (e instanceof DeviceError) {
      switch (e.code) {
        case RETURN_CODE.DENIED:
          state.screenContent = "Not confirmed";
          emits("denied");
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
    app.transport.close();
    state.loading = false;
    state.connected = false;
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="text-sm">
      <div class="mb-2 text-center">
        <h1 class="font-bold text-lg">Address confirmation</h1>
      </div>

      <div v-if="state.appId" class="flex flex-col gap-4">
        <p>
          Ensure that the <span class="font-semibold">address</span> and
          <span class="font-semibold">path</span> below matches precisely what appears on your
          device, then press
          <span class="font-semibold text-xs tag">Approve</span>
          to confirm.
        </p>
        <div>
          <label>Address</label>
          <div class="rounded font-mono bg-gray-50 text-sm p-2 break-all border-gray-200 border">
            {{ address }}
            <!-- <p><span class="font-semibold font-sans">Path:</span> {{ path }}</p> -->
          </div>
        </div>

        <div>
          <label>Path</label>
          <div class="rounded font-mono bg-gray-50 text-sm p-2 break-all border-gray-200 border">
            {{ path }}
            <!-- <p><span class="font-semibold `font-sans`">Path:</span> {{ path }}</p> -->
          </div>
        </div>
      </div>
    </div>

    <ledger-device
      :connected="state.connected"
      :screen-text="state.screenContent"
      :caption="state.caption"
      :model="state.model"
      :loading="state.loading"
      :state="state.state"
      :app-id="state.appId"
      compact-view
    />
  </div>
</template>
