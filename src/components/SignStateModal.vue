<script setup lang="ts">
import { PropType, computed } from "vue";
import { ProverStateType } from "../types/internal";
import { isDefined } from "@fleet-sdk/common";
import store from "../store";

const emit = defineEmits(["close"]);

const props = defineProps({
  title: { type: String, required: true },
  caption: { type: String },
  animate: { type: Boolean, default: true },
  txId: { type: String, required: false },
  state: { type: Number as PropType<ProverStateType>, required: false }
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
  return new URL(`/transactions/${txId}`, store.state.settings.explorerUrl).toString();
}
</script>

<template>
  <o-modal
    :active="active"
    :auto-focus="true"
    :can-cancel="closable"
    content-class="!w-auto rounded"
    :animation="animate ? undefined : ''"
    @close="emit('close')"
    scroll="clip"
  >
    <div class="p-5 min-w-60 max-w-85 text-center">
      <div :class="stateClass" class="w-full h-26">
        <vue-feather
          v-if="state === ProverStateType.success"
          type="check-circle"
          class="w-25 h-25"
        />
        <vue-feather
          v-else-if="state === ProverStateType.error"
          type="alert-circle"
          class="w-25 h-25"
        />
        <loading-indicator v-else type="circular" class="w-25 h-25 !stroke-gray-500" />
      </div>
      <h1 class="pt-4 font-semibold text-xl" :class="stateClass">{{ titleText }}</h1>
      <p class="pt-2 font-normal text-sm" v-if="caption">{{ caption }}</p>
      <a
        v-if="state === ProverStateType.success && txId"
        class="url pt-2 font-normal text-sm"
        :href="getTransactionExplorerUrl(txId)"
        target="_blank"
        rel="noopener noreferrer"
        >View transaction on Explorer</a
      >
    </div>
  </o-modal>
</template>
