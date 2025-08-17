<script setup lang="ts">
import { reactive } from "vue";
import { Buffer } from "@keystonehq/bc-ur-registry";
import { ErgoSignedTx, ErgoSignRequest } from "@keystonehq/bc-ur-registry-ergo";
import { UR } from "@keystonehq/keystone-sdk";
import { useI18n } from "vue-i18n";
import KeystoneAnimatedQr from "@/components/KeystoneAnimatedQr.vue";
import KeystoneQrReader from "@/components/KeystoneQrReader.vue";
import { useToast } from "@/components/ui/toast";
import { ProverState } from "@/chains/ergo/transaction/prover.ts";

interface Props {
  initialState?: ProverState;
}

const props = withDefaults(defineProps<Props>(), {
  initialState: () => ({
    state: undefined
  })
});

const state = reactive<ProverState>({
  type: props.initialState.type,
  label: props.initialState.label
});

const { toast } = useToast();
const { t } = useI18n();

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
    console.error(e);
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
    <div class="mx-auto h-[100px] h-max">
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
