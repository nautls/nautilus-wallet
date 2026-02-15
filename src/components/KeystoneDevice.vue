<script setup lang="ts">
import { reactive } from "vue";
import { Buffer } from "@keystonehq/bc-ur-registry";
import { ErgoSignedTx } from "@keystonehq/bc-ur-registry-ergo";
import { UR } from "@keystonehq/keystone-sdk";
import KeystoneAnimatedQr from "@/components/KeystoneAnimatedQr.vue";
import KeystoneQrReader from "@/components/KeystoneQrReader.vue";
import { ProverState } from "@/chains/ergo/transaction/prover.ts";
import { log } from "@/common/logger";

interface Props {
  initialState?: ProverState;
}

const props = defineProps<Props>();

const state = reactive<ProverState>({
  type: props.initialState?.type,
  label: props.initialState?.label
});

function setState(newState: ProverState) {
  Object.assign(state, newState);
}

function getState() {
  return state;
}

const handleScan = (ur: UR) => {
  try {
    const cborHex = ur.cbor.toString("hex");
    const ergoSignedTx = ErgoSignedTx.fromCBOR(Buffer.from(cborHex, "hex"));
    setState({
      type: "scanned",
      response: ergoSignedTx
    });
  } catch (e) {
    log.error(e);
  }
};

function startScan() {
  setState({
    type: "scanning",
    label: undefined
  });
}

defineExpose({ setState, getState, startScan });
</script>

<template>
  <div class="flex h-min flex-col items-center gap-2">
    <div class="mx-auto h-max">
      <keystone-qr-reader v-if="state.type === 'scanning'" :handle-scan="handleScan" />
      <keystone-animated-qr
        class="max-h-52"
        v-if="state.type === 'display'"
        :ur="state.request?.toUR()"
      />
      <p v-if="state.label" class="text-sm font-semibold opacity-90">
        {{ state.label }}
      </p>
    </div>
  </div>
</template>
