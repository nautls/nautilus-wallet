<script setup lang="ts">
import { LedgerDeviceModelId } from "@/constants/ledger";
import { PropType, computed } from "vue";
import { ProverStateType } from "@/types/internal";
import ledgerS from "@/assets/images/hw-devices/ledger-s.svg";
import ledgerX from "@/assets/images/hw-devices/ledger-x.svg";
import { isDefined } from "@fleet-sdk/common";

const props = defineProps({
  model: {
    type: String as PropType<LedgerDeviceModelId>,
    default: LedgerDeviceModelId.nanoX
  },
  state: { type: Number as PropType<ProverStateType>, required: false },
  connected: { type: Boolean },
  screenText: { type: String },
  loading: { type: Boolean },
  caption: { type: String, required: false },
  compactView: { type: Boolean },
  appId: { type: Number, required: false }
});

const validState = computed(
  () => isDefined(props.state) && props.state !== ProverStateType.unavailable
);
const appIdHex = computed(() => (!props.appId ? "" : `0x${props.appId.toString(16)}`));
const isNanoX = computed(() => props.model === LedgerDeviceModelId.nanoX);
const isLoading = computed(() => props.state === ProverStateType.busy || props.loading);
const screenPosition = computed(() =>
  isNanoX.value ? "top-19.1 left-15.1 w-28.5 h-8" : "top-19.5 left-8.3 w-30 h-8"
);
</script>

<template>
  <div class="flex gap-2 flex-col mx-auto items-center min-w-72 max-w-75 w-75 p-2">
    <div v-if="connected || validState" class="w-auto mx-auto text-center text-sm">
      <div
        v-if="connected && appId"
        class="inline-flex gap-2 items-center rounded-md bg-gray-50 px-2 py-1 text-xs text-gray-600 ring-1 ring-inset ring-gray-500/10"
      >
        Application ID: <span class="font-bold">{{ appIdHex }}</span>
      </div>
      <div class="relative">
        <ledger-x v-if="isNanoX" class="w-max" />
        <ledger-s v-else class="w-max" />
        <div :class="screenPosition" class="absolute text-light-600 text-xs items-center">
          <div class="h-full flex items-center justify-center gap-2">
            <loading-indicator
              v-if="isLoading && compactView"
              type="circular"
              class="w-5 h-5 mx-0.5"
            />
            <vue-feather
              v-else-if="state === ProverStateType.success"
              type="check"
              class="text-green-300"
            />
            <vue-feather
              v-else-if="state === ProverStateType.error"
              type="x"
              class="text-red-300"
            />

            <span v-if="screenText" class="font-semibold">{{ screenText }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="state === ProverStateType.unavailable">
      <p class="text-center text-red-600">
        <vue-feather type="alert-circle" size="64" />
      </p>
      <p class="text-center font-semibold">Ledger device not found!</p>
      <p class="px-1 pt-4 text-sm text-gray-500">
        Before you try again, please make sure your device is connected and the
        <span class="font-semibold">Ledger Ergo App</span> is installed and opened.
      </p>
    </div>

    <div v-if="isLoading && !compactView" class="text-center pb-2">
      <loading-indicator type="circular" class="w-10 h-10" />
    </div>

    <p v-if="caption" class="text-center" :class="{ 'text-sm ': compactView }" v-html="caption"></p>
  </div>
</template>
