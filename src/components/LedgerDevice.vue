<script setup lang="ts">
import { computed, PropType } from "vue";
import { isDefined } from "@fleet-sdk/common";
import { CheckIcon, CircleAlertIcon, Loader2Icon, XIcon } from "lucide-vue-next";
import LedgerNanoS from "@/assets/images/hw-devices/ledger-nanosp.svg?skipsvgo";
import LedgerNanoX from "@/assets/images/hw-devices/ledger-nanox.svg?skipsvgo";
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
const screenDefs = computed(() =>
  isNanoX.value
    ? "top-[12px] left-[57px] w-[111px] h-[51px]"
    : "top-[15px] left-[32px] w-[111px] h-[51px]"
);
</script>

<template>
  <div class="mx-auto flex flex-col items-center gap-2 w-[240px] h-min">
    <div v-if="connected || validState" class="mx-auto w-auto text-center text-sm">
      <div class="relative">
        <LedgerNanoX v-if="isNanoX" />
        <LedgerNanoS v-else />

        <div
          :class="screenDefs"
          class="absolute flex flex-col items-center justify-around gap-0 leading-none px-1 text-xs text-white bg-blue-50/0"
        >
          <Loader2Icon v-if="loading" class="inline size-3 animate-spin opacity-70" />
          <check-icon v-else-if="state === ProverStateType.success" class="text-green-300" />
          <x-icon v-else-if="state === ProverStateType.error" class="text-red-300" />

          <p v-if="screenText" class="font-semibold opacity-90 text-[0.70rem]">
            <!-- Review transaction on your device -->
            Signing
          </p>
          <small class="flex-shrink opacity-70">App ID: 0x12828</small>
        </div>
      </div>

      <div
        v-if="appId"
        class="mx-auto -mt-4 mb-2 w-min whitespace-nowrap rounded-md border border-gray-500/10 bg-gray-50 px-2 py-1 text-xs text-gray-600"
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
