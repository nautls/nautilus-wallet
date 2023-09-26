<script setup lang="ts">
import { ErgoTx, UnsignedTx } from "@/types/connector";
import { PropType, computed, nextTick, onMounted, reactive, ref } from "vue";
import TxSignView from "./TxSignView.vue";
import SignStateModal from "@/components/SignStateModal.vue";
import {
  ProverStateType,
  SigningState,
  TransactionBuilderFunction,
  WalletType
} from "@/types/internal";
import { submitTx } from "@/api/ergo/submitTx";
import store from "@/store";
import { PartialSignState } from "../api/ergo/transaction/prover";

const props = defineProps({
  submit: { type: Boolean, default: true },
  onTransactionBuild: {
    type: Function as PropType<TransactionBuilderFunction>,
    required: true
  }
});

const emit = defineEmits(["success", "fail", "refused", "close"]);

const transaction = ref<UnsignedTx | undefined>();

const signState = reactive({
  message: "",
  txId: "",
  type: undefined as ProverStateType | undefined,
  animate: true
});

const isLedger = computed(() => {
  return store.state.currentWallet.type === WalletType.Ledger;
});

onMounted(async () => {
  transaction.value = await buildTransaction();

  if (signState.type === ProverStateType.busy) {
    setState();
  }
});

async function buildTransaction() {
  try {
    return await props.onTransactionBuild();
  } catch (e) {
    setState(ProverStateType.error, typeof e === "string" ? e : (e as Error).message);
  }
}

function setState(stateType?: ProverStateType, message?: string, txId?: string) {
  if (isLedger.value && stateType === ProverStateType.busy) {
    return;
  }

  signState.type = stateType;
  signState.message = message ?? "";
  signState.txId = txId ?? "";
}

function fail(info: string) {
  emit("fail", info);
  close();
}

function refused(info: string) {
  emit("refused", info);
  close();
}

async function success(
  signedTx: ErgoTx,
  setStateEx: (state: ProverStateType, obj: PartialSignState) => void
) {
  if (!props.submit) {
    emit("success", signedTx);
    return;
  }

  setStateEx(ProverStateType.busy, { statusText: "Sending transaction..." });

  try {
    const txId = await submitTx(signedTx, store.state.currentWallet.id);
    setStateEx(ProverStateType.success, { statusText: "Sent!" });
    setState(ProverStateType.success, "", txId);

    emit("success", signedTx);
  } catch (e) {
    setState(ProverStateType.error, typeof e === "string" ? e : (e as Error).message);
  }
}

function close(): void {
  emit("close");
}

function onLoadingModalClose() {
  if (signState.type === ProverStateType.error) {
    setState();
    return;
  }

  signState.animate = false;
  setState();

  nextTick(() => {
    close();
  });
}
</script>

<template>
  <div class="flex flex-col h-full gap-4">
    <div class="mb-2 text-center">
      <h1 class="font-bold text-lg">Transaction Review</h1>
      <p class="text-xs">Please review your transaction before you sign it.</p>
    </div>

    <tx-sign-view
      :transaction="transaction"
      :is-modal="true"
      :set-external-state="setState"
      @fail="fail"
      @refused="refused"
      @success="success"
    />

    <sign-state-modal
      title="Loading"
      @close="onLoadingModalClose()"
      :caption="signState.message"
      :state="signState.type"
      :tx-id="signState.txId"
      :animate="signState.animate"
    />
  </div>
</template>
