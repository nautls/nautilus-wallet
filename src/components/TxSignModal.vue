<script setup lang="ts">
import { computed, nextTick, onMounted, PropType, reactive, ref } from "vue";
import { EIP12UnsignedTransaction, SignedTransaction } from "@fleet-sdk/common";
import { useWalletStore } from "@/stores/walletStore";
import SignStateModal from "@/components/SignStateModal.vue";
import { graphQLService } from "@/chains/ergo/services/graphQlService";
import { PartialSignState } from "@/chains/ergo/transaction/prover";
import { ProverStateType, TransactionBuilderFunction, WalletType } from "@/types/internal";
import TxSignView from "./TxSignView.vue";

const wallet = useWalletStore();

const props = defineProps({
  submit: { type: Boolean, default: true },
  onTransactionBuild: {
    type: Function as PropType<TransactionBuilderFunction>,
    required: true
  }
});

const emit = defineEmits(["success", "fail", "refused", "close"]);

const transaction = ref<EIP12UnsignedTransaction>();

const signState = reactive({
  message: "",
  txId: "",
  type: undefined as ProverStateType | undefined,
  animate: true
});

const isLedger = computed(() => wallet.type === WalletType.Ledger);

onMounted(async () => {
  transaction.value = await buildTransaction();
  if (signState.type === ProverStateType.busy) setState();
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
  closeWindow();
}

function refused(info: string) {
  emit("refused", info);
  closeWindow();
}

async function success(
  signedTx: SignedTransaction,
  setStateEx: (state: ProverStateType, obj: PartialSignState) => void
) {
  if (!props.submit) {
    emit("success", signedTx);
    return;
  }

  setStateEx(ProverStateType.busy, { statusText: "Sending transaction..." });

  try {
    const result = await graphQLService.submitTransaction(signedTx, wallet.id);
    setStateEx(ProverStateType.success, { statusText: "Sent!" });
    setState(ProverStateType.success, "", result.transactionId);

    emit("success", signedTx);
  } catch (e) {
    setState(ProverStateType.error, typeof e === "string" ? e : (e as Error).message);
  }
}

function closeWindow(): void {
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
    closeWindow();
  });
}
</script>

<template>
  <div class="flex h-full flex-col gap-4">
    <div class="mb-2 text-center">
      <h1 class="text-lg font-bold">Transaction Review</h1>
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
      :caption="signState.message"
      :state="signState.type"
      :tx-id="signState.txId"
      :animate="signState.animate"
      @close="onLoadingModalClose()"
    />
  </div>
</template>
