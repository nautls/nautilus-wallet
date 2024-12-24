<script setup lang="ts">
import { computed, PropType } from "vue";
import { isDefined } from "@fleet-sdk/common";
import { CircleAlertIcon, CircleCheckIcon } from "lucide-vue-next";
import { useAppStore } from "@/stores/appStore";
import { ProverStateType } from "../types/internal";

const app = useAppStore();

const emit = defineEmits(["close"]);

const props = defineProps({
  title: { type: String, required: true },
  caption: { type: String, default: undefined },
  animate: { type: Boolean, default: true },
  txId: { type: String, required: false, default: undefined },
  state: { type: Number as PropType<ProverStateType>, required: false, default: undefined }
});

const stateClass = computed(() => {
  if (props.state === ProverStateType.success) {
    return "text-green-600";
  } else if (props.state === ProverStateType.error) {
    return "text-red-600";
  } else {
    return "text-gray-600";
  }
});

const titleText = computed(() => {
  if (props.state === ProverStateType.success) {
    return "Success!";
  } else if (props.state === ProverStateType.error) {
    return "Error";
  } else {
    return props.title;
  }
});

const active = computed(() => isDefined(props.state));
const closable = computed(
  () => props.state === ProverStateType.success || props.state === ProverStateType.error
);

function getTransactionExplorerUrl(txId: string): string {
  return new URL(`/transactions/${txId}`, app.settings.explorerUrl).toString();
}
</script>

<template>
  <o-modal
    :active="active"
    :auto-focus="true"
    :can-cancel="closable"
    content-class="!w-auto rounded"
    :animation="animate ? undefined : ''"
    scroll="clip"
    @close="emit('close')"
  >
    <div class="max-w-85 min-w-60 p-5 text-center">
      <div :class="stateClass" class="h-26 w-full">
        <circle-check-icon v-if="state === ProverStateType.success" class="inline h-24 w-24" />
        <circle-alert-icon v-else-if="state === ProverStateType.error" class="inline h-24 w-24" />
        <loading-indicator v-else type="circular" class="h-24 w-24 !stroke-gray-500" />
      </div>
      <h1 class="pt-4 text-xl font-semibold" :class="stateClass">{{ titleText }}</h1>
      <p v-if="caption" class="pt-2 text-sm font-normal">{{ caption }}</p>
      <a
        v-if="state === ProverStateType.success && txId"
        class="url pt-2 text-sm font-normal"
        :href="getTransactionExplorerUrl(txId)"
        target="_blank"
        rel="noopener noreferrer"
        >View transaction on Explorer</a
      >
    </div>
  </o-modal>
</template>
