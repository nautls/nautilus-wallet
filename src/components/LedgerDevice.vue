<script setup lang="ts">
import { computed } from "vue";
import { isDefined } from "@fleet-sdk/common";
import { CheckIcon, CircleAlertIcon, Loader2Icon, XIcon } from "lucide-vue-next";
import LedgerNanoS from "@/assets/images/hw-devices/ledger-nanosp.svg?skipsvgo";
import LedgerNanoX from "@/assets/images/hw-devices/ledger-nanox.svg?skipsvgo";
import { LedgerDeviceModelId, ProverState } from "@/chains/ergo/transaction/prover";

interface Props {
  model?: LedgerDeviceModelId;
  state?: ProverState;
  connected?: boolean;
  screenText?: string;
  loading?: boolean;
  caption?: string;
  compactView?: boolean;
  appId?: number;
}

const props = withDefaults(defineProps<Props>(), {
  model: "nanoSP",
  state: undefined,
  screenText: undefined,
  caption: undefined,
  appId: undefined
});

const validState = computed(() => isDefined(props.state) && props.state !== "unavailable");
const appIdHex = computed(() => (!props.appId ? "" : `0x${props.appId.toString(16)}`));
const isNanoX = computed(() => props.model === "nanoX");
const isLoading = computed(() => props.state === "busy" || props.loading);
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
          <check-icon v-else-if="state === 'success'" class="text-green-300" />
          <x-icon v-else-if="state === 'error'" class="text-red-300" />

          <p v-if="screenText" class="font-semibold opacity-90 text-[0.70rem]">
            <!-- Review transaction on your device -->
            <!-- Signing -->
            {{ screenText }}
          </p>
          <small v-if="appId" class="flex-shrink opacity-70">App ID: {{ appId }}</small>
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
