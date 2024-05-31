<script setup lang="ts">
import DappPlate from "@/components/DappPlate.vue";
import TxSignView from "@/components/TxSignView.vue";
import { ref, watch } from "vue";
import { SignTxInputsRequest, SignTxRequest } from "@/background/asyncRequestQueue";
import { onMounted } from "vue";
import { error, InternalRequest, success } from "@/background/messaging";
import { queue } from "@/background/rpcHandler";
import { SignTxArgs, SignTxInputsArgs } from "@/@types/webext-rpc";
import { connectedDAppsDbService } from "@/api/database/connectedDAppsDbService";
import { APIErrorCode, SignErrorCode } from "@/types/connector";
import store from "@/store";
import { ACTIONS } from "@/constants/store";
import { computed } from "vue";
import { SignedTransaction, some } from "@fleet-sdk/common";

type RequestType = SignTxRequest<SignTxArgs> | SignTxInputsRequest<SignTxInputsArgs>;

const request = ref<RequestType>();
const walletId = ref(0);

watch(
  () => store.state.loading.wallets,
  (loading) => setWallet(loading, walletId.value),
  { immediate: true }
);

watch(
  () => walletId.value,
  (walletId) => setWallet(store.state.loading.wallets, walletId),
  { immediate: true }
);

watch(
  () => request.value,
  (newReq) => {
    if (!newReq) return;
    const tokenIds = newReq.data.transaction.inputs
      .filter((x) => some(x.assets))
      .flatMap((x) => x.assets)
      .map((x) => x.tokenId);

    if (some(tokenIds)) {
      store.dispatch(ACTIONS.LOAD_ASSETS_INFO, tokenIds);
    }
  }
);

function setWallet(loading: boolean, walletId: number) {
  if (loading || !walletId) return;
  store.dispatch(ACTIONS.SET_CURRENT_WALLET, walletId);
}

const inputsToSign = computed(() => {
  if (request.value?.type === InternalRequest.SignTxInputs) {
    return request.value.data.indexes;
  }

  return undefined;
});

const isPartialSign = computed(() => {
  return (
    request.value?.type === InternalRequest.SignTxInputs &&
    request.value.data.indexes.length > 0 &&
    request.value.data.indexes.length < request.value.data.transaction.inputs.length
  );
});

onMounted(async () => {
  request.value = queue.pop(InternalRequest.SignTx) || queue.pop(InternalRequest.SignTxInputs);
  if (!request.value) return;

  const connection = await connectedDAppsDbService.getByOrigin(request.value.origin);
  if (!connection || !connection.walletId) {
    request.value.resolve(error(APIErrorCode.Refused, "Unauthorized."));
    window.close();
    return;
  }

  walletId.value = connection.walletId;
  window.addEventListener("beforeunload", refuse);
});

function refuse() {
  request.value?.resolve(error(SignErrorCode.UserDeclined, "User rejected."));
}

function onSuccess(signedTx: SignedTransaction) {
  request.value?.resolve(success(signedTx));
  close();
}

function onRefused(info: string) {
  request.value?.resolve(error(SignErrorCode.UserDeclined, info));
  close();
}

function onFail(info: string) {
  request.value?.resolve(error(SignErrorCode.ProofGeneration, info));
  close();
}

function close() {
  window.removeEventListener("beforeunload", refuse);
  window.close();
}
</script>

<template>
  <div class="flex flex-col h-full gap-4">
    <dapp-plate :origin="request?.origin" :favicon="request?.favicon" compact />
    <h1 class="text-xl m-auto text-center">
      <template v-if="isPartialSign">Wants to partially sign a transaction</template>
      <template v-else>Wants to sign a transaction</template>
    </h1>
    <tx-sign-view
      v-if="request?.data"
      :transaction="request.data.transaction"
      :inputs-to-sign="inputsToSign"
      @fail="onFail"
      @refused="onRefused"
      @success="onSuccess"
    />
  </div>
</template>
