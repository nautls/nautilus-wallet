<script setup lang="ts">
import { isDefined } from "@fleet-sdk/common";
import { computed, PropType } from "vue";
import { CheckIcon, CircleAlertIcon, XIcon } from "lucide-vue-next";
import ledgerS from "@/assets/images/hw-devices/ledger-s.svg";
import ledgerX from "@/assets/images/hw-devices/ledger-x.svg";
import { LedgerDeviceModelId } from "@/constants/ledger";
import { ProverStateType } from "@/types/internal";

const props = defineProps({
  model: {
    type: String as PropType<LedgerDeviceModelId>,
    default: LedgerDeviceModelId.nanoX
  },
  state: { type: Number as PropType<ProverStateType>, required: false, default: undefined },
  connected: { type: Boolean },
  screenText: { type: String, default: undefined },
  loading: { type: Boolean },
  caption: { type: String, required: false, default: undefined },
  compactView: { type: Boolean },
  appId: { type: Number, required: false, default: undefined }
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
  <div class="mx-auto flex min-w-72 flex-col items-center gap-2 p-2">
    <div v-if="connected || validState" class="mx-auto w-auto text-center text-sm">
      <div class="relative">
        <ledger-x v-if="isNanoX" class="w-max" />
        <ledger-s v-else class="w-max" />
        <div :class="screenPosition" class="absolute items-center px-1 text-xs text-light-600">
          <div class="flex h-full items-center justify-center gap-1">
            <loading-indicator
              v-if="isLoading && compactView"
              type="circular"
              class="h-5 w-5 min-w-5"
            />
            <check-icon v-else-if="state === ProverStateType.success" class="text-green-300" />
            <x-icon v-else-if="state === ProverStateType.error" class="text-red-300" />

            <span v-if="screenText" class="font-semibold">{{ screenText }}</span>
          </div>
        </div>
      </div>

      <div
        v-if="appId"
        class="border-1 mx-auto -mt-4 mb-2 w-min whitespace-nowrap rounded-md border-gray-500/10 bg-gray-50 px-2 py-1 text-xs text-gray-600"
      >
        Application ID: <span class="font-bold">{{ appIdHex }}</span>
      </div>
    </div>
    <div v-else-if="!validState">
      <p class="text-center text-red-600">
        <circle-alert-icon :size="64" />
      </p>
      <p class="text-center font-semibold">Ledger device not found!</p>
      <p class="px-1 pt-4 text-sm text-gray-500">
        Before you try again, please make sure your device is connected and the
        <span class="font-semibold">Ledger Ergo App</span> is installed and opened.
      </p>
    </div>

    <div v-if="isLoading && !compactView" class="pb-2 text-center">
      <loading-indicator type="circular" class="h-10 w-10" />
    </div>

    <!-- eslint-disable-next-line vue/no-v-html -->
    <p v-if="caption" class="text-center" :class="{ 'text-sm': compactView }" v-html="caption"></p>
  </div>
</template>
