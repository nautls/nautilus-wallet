<template>
  <div class="flex gap-2 flex-col mx-auto items-center min-w-72 max-w-75 w-75 p-4">
    <div
      v-if="connected || (state !== 'unknown' && state !== 'deviceNotFound')"
      class="w-auto mx-auto text-center text-sm"
    >
      <div class="relative">
        <ledger-nano-x v-if="isNanoX" class="w-max" />
        <ledger-nano-s v-else class="w-max" />
        <div :class="screenPosition" class="absolute text-light-600 text-xs items-center">
          <div class="flex h-full items-center">
            <div class="w-full h-auto">
              <p v-if="state === 'success'">
                <vue-feather type="check" class="pt-1 text-green-300" />
              </p>
              <p v-else-if="state === 'error'">
                <vue-feather type="x" class="pt-1 text-red-300" />
              </p>
              <p v-else-if="screenText" v-html="screenText" class="font-semibold"></p>
              <p v-else-if="appId">
                Application<br />
                <span class="font-bold">{{ appIdHex }}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-if="state === 'deviceNotFound'">
      <p class="text-center text-red-600">
        <vue-feather type="alert-circle" size="64" />
      </p>
      <p class="text-center font-semibold">Ledger device not found!</p>
      <p class="px-1 pt-4 text-sm text-gray-500">
        Before you try again, please make sure your device is connected and the
        <span class="font-semibold">Ledger Ergo App</span> is installed and opened.
      </p>
    </div>

    <div v-if="loading" class="text-center pb-2">
      <loading-indicator type="circular" class="w-10 h-10" />
    </div>
    <p v-if="bottomText" class="text-center" v-html="bottomText"></p>
  </div>
</template>

<script lang="ts">
import { LedgerDeviceModelId } from "@/constants/ledger";
import { defineComponent } from "vue";
import ledgerNanoS from "@/assets/images/hw-devices/ledger-s.svg";
import ledgerNanoX from "@/assets/images/hw-devices/ledger-x.svg";

export default defineComponent({
  name: "LedgerDevice",
  components: {
    ledgerNanoS,
    ledgerNanoX
  },
  props: {
    state: { type: String, required: false },
    screenText: { type: String, required: false },
    bottomText: { type: String, required: false },
    deviceModel: { Type: String, default: "unknown" },
    connected: { type: Boolean, default: false },
    loading: { type: Boolean, default: false },
    appId: { type: Number, required: false }
  },
  computed: {
    screenPosition() {
      if (this.isNanoX) {
        return "top-19.1 left-15.1 w-28.5 h-8";
      } else {
        return "top-19.5 left-8.3 w-30 h-8";
      }
    },
    isNanoX() {
      return this.deviceModel === LedgerDeviceModelId.nanoX;
    },
    appIdHex(): string {
      if (!this.appId) {
        return "";
      }

      return `0x${this.appId.toString(16)}`;
    }
  }
});
</script>
