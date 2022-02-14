<template>
  <div class="flex gap-2 flex-col mx-auto items-center min-w-62 max-w-65 w-65">
    <div
      v-if="connected || (state !== 'unknown' && state !== 'deviceNotFound')"
      class="w-auto mx-auto text-center text-sm"
    >
      <div class="relative">
        <img v-if="isNanoX" src="@/assets/images/hw-devices/ledger-x.svg" class="w-60" />
        <img v-else src="@/assets/images/hw-devices/ledger-s.svg" class="w-55" />
        <div :class="screenPosition" class="absolute text-light-500 text-xs items-center">
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
      <p class="px-1 pt-2 text-sm text-gray-500">
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

export default defineComponent({
  name: "LedgerDevice",
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
        return "top-18 left-14 w-28.5 h-8";
      } else {
        return "top-17.5 left-7 w-28.5 h-8";
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
