<script setup lang="ts">
import { ErgoTx, UnsignedTx } from "@/types/connector";
import { PropType, computed, nextTick, onMounted, reactive, ref } from "vue";
import TxSignView from "./TxSignView.vue";
import LoadingModal from "@/components/LoadingModal.vue";
import { LoadingModalState, TransactionBuilderFunction, WalletType } from "@/types/internal";
import { submitTx } from "@/api/ergo/submitTx";
import store from "@/store";

const props = defineProps({
  submit: { type: Boolean, default: true },
  onTransactionBuild: {
    type: Function as PropType<TransactionBuilderFunction>,
    required: true
  }
});

const emit = defineEmits(["success", "fail", "refused", "close"]);

const transaction = ref<UnsignedTx | undefined>();
const loading = reactive({
  message: "",
  state: "unknown" as LoadingModalState,
  animate: true
});

const isLedger = computed(() => {
  return store.state.currentWallet.type === WalletType.Ledger;
});

onMounted(async () => {
  transaction.value = await buildTransaction();

  if (loading.state === "loading") {
    setState("unknown");
  }
});

async function buildTransaction() {
  try {
    return await props.onTransactionBuild();
  } catch (e) {
    setState("error", typeof e === "string" ? e : (e as Error).message);
  }
}

function setState(state: LoadingModalState, message = "") {
  if (isLedger.value && state === "loading") {
    return;
  }

  loading.state = state;
  loading.message = message;
}

function fail(info: string) {
  emit("fail", info);
  close();
}

function refused(info: string) {
  emit("refused", info);
  close();
}

async function success(signedTx: ErgoTx) {
  if (!props.submit) {
    emit("success", signedTx);
    return;
  }

  setState("loading", "Submitting transaction...");

  try {
    const txId = await submitTx(signedTx, store.state.currentWallet.id);
    setState(
      "success",
      `Transaction submitted<br><a class='url' href='${getTransactionExplorerUrl(
        txId
      )}' target='_blank'>View on Explorer</a>`
    );
    emit("success", signedTx);
  } catch (e) {
    setState("error", typeof e === "string" ? e : (e as Error).message);
  }
}

function getTransactionExplorerUrl(txId: string): string {
  return new URL(`/transactions/${txId}`, store.state.settings.explorerUrl).toString();
}

function close(): void {
  emit("close");
}

function onLoadingModalClose() {
  if (loading.state === "error") {
    setState("unknown");
    return;
  }

  loading.animate = false;
  setState("unknown");

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

    <loading-modal
      title="Loading"
      @close="onLoadingModalClose()"
      :message="loading.message"
      :state="loading.state"
      :animate="loading.animate"
    />
  </div>
</template>
