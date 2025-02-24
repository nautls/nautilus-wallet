<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { SignedInput, SignedTransaction, some } from "@fleet-sdk/common";
import { useEventListener } from "@vueuse/core";
import { useAssetsStore } from "@/stores/assetsStore";
import { useWalletStore } from "@/stores/walletStore";
import DappPlateHeader from "@/components/DappPlateHeader.vue";
import { TransactionSign } from "@/components/transaction";
import { connectedDAppsDbService } from "@/database/connectedDAppsDbService";
import { AsyncRequest } from "@/extension/connector/rpc/asyncRequestQueue";
import { error, InternalRequest, success } from "@/extension/connector/rpc/protocol";
import { queue } from "@/extension/connector/rpc/uiRpcHandlers";
import { APIErrorCode, SignErrorCode } from "@/types/connector";
import { SignTxArgs, SignTxInputsArgs } from "@/types/d.ts/webext-rpc";

type RequestType = AsyncRequest<SignTxArgs | SignTxInputsArgs>;

const assets = useAssetsStore();
const wallet = useWalletStore();

const request = ref<RequestType>();
const walletId = ref(0);

watch(
  () => wallet.loading,
  (loading) => setWallet(loading, walletId.value),
  { immediate: true }
);

watch(
  () => walletId.value,
  (walletId) => setWallet(wallet.loading, walletId),
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

    if (tokenIds.length > 0) {
      assets.loadMetadata(tokenIds, { persist: false });
    }
  }
);

function setWallet(loading: boolean, walletId: number) {
  if (loading || !walletId) return;
  wallet.load(walletId);
}

const inputsToSign = computed(() => {
  if (!isSignInputsRequest(request.value)) return undefined;
  return request.value.data.indexes;
});

const isPartialSign = computed(() => {
  return (
    isSignInputsRequest(request.value) &&
    request.value.data.indexes.length > 0 &&
    request.value.data.indexes.length < request.value.data.transaction.inputs.length
  );
});

function isSignInputsRequest(req?: RequestType): req is AsyncRequest<SignTxInputsArgs> {
  return req?.type === InternalRequest.SignTxInputs;
}

const detachBeforeUnloadListener = useEventListener(window, "beforeunload", refuse);

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
});

function refuse() {
  request.value?.resolve(error(SignErrorCode.UserDeclined, "User rejected."));
}

function onSuccess(signedTx: SignedTransaction | SignedInput[]) {
  request.value?.resolve(success(signedTx));
  closeWindow();
}

function onRefused() {
  refuse();
  closeWindow();
}

function onFail(info: string) {
  request.value?.resolve(error(SignErrorCode.ProofGeneration, info));
  closeWindow();
}

function closeWindow() {
  detachBeforeUnloadListener();
  window.close();
}
</script>

<template>
  <DappPlateHeader :origin="request?.origin" :favicon="request?.favicon">
    <template v-if="isPartialSign">
      requests to <span class="font-semibold">partially</span> sign a transaction
    </template>
    <template v-else>requests to sign a transaction</template>
  </DappPlateHeader>

  <TransactionSign
    :transaction="request?.data.transaction"
    :inputs-to-sign="inputsToSign"
    @refused="onRefused"
    @fail="onFail"
    @success="onSuccess"
  />
</template>
