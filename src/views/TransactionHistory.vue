<script setup lang="ts">
import { computed, ref, shallowRef, useTemplateRef, watch } from "vue";
import { BoxSummary, orderBy, uniqBy } from "@fleet-sdk/common";
import { ErgoAddress } from "@fleet-sdk/core";
import { formatTimeAgo, useInfiniteScroll } from "@vueuse/core";
import type { BigNumber } from "bignumber.js";
import { ClockIcon, DownloadIcon, UploadIcon } from "lucide-vue-next";
import { useAppStore } from "@/stores/appStore";
import { useAssetsStore } from "@/stores/assetsStore";
import { useChainStore } from "@/stores/chainStore";
import { usePoolStore } from "@/stores/poolStore";
import { useWalletStore } from "@/stores/walletStore";
import EmptyLogo from "@/assets/images/tokens/asset-empty.svg";
import { graphQLService } from "@/chains/ergo/services/graphQlService";
import { summarizeTransaction } from "@/chains/ergo/transaction/interpreter/utils";
import { createRBFCancellationTransaction } from "@/chains/ergo/transaction/txBuilder";
import { bn, decimalize } from "@/common/bigNumber";
import { openTransactionSigningModal } from "@/common/componentUtils";
import { useFormat } from "@/composables";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import { AddressState } from "@/types/internal";
import type {
  ConfirmedTransactionSummary,
  UnconfirmedTransactionSummary
} from "@/types/transactions";

const formatter = useFormat();

const wallet = useWalletStore();
const assets = useAssetsStore();
const chain = useChainStore();
const app = useAppStore();
const pool = usePoolStore();

const confirmed = shallowRef<ConfirmedTransactionSummary[]>([]);
const allLoaded = ref(false);

const allAddresses = computed(() => wallet.addresses.map((x) => x.script));
const usedAddresses = computed(() =>
  wallet.addresses.filter((x) => x.state === AddressState.Used).map((x) => x.script)
);
const ergoTrees = computed(
  () => new Set(allAddresses.value.map((x) => ErgoAddress.decodeUnsafe(x).ergoTree))
);

const confirmedGenerator = computed(() => {
  if (!usedAddresses.value.length) return;
  return graphQLService.streamConfirmedTransactions({
    where: { addresses: usedAddresses.value, onlyRelevantOutputs: true }
  });
});

const txHistory = computed(() =>
  orderBy(
    uniqBy([...pool.transactions, ...confirmed.value], (x) => x.transactionId, "keep-last"),
    (x) => x.timestamp,
    "desc"
  ).map((x) => ({ ...x, delta: mapDelta(x.delta) }))
);

function mapDelta(utxoSummary: BoxSummary) {
  const tokens = utxoSummary.tokens.map((x) => token(x.tokenId, x.amount));
  return utxoSummary.nanoErgs === 0n
    ? tokens
    : [token(ERG_TOKEN_ID, utxoSummary.nanoErgs), ...tokens];
}

function token(tokenId: string, amount: bigint) {
  const metadata = assets.metadata.get(tokenId);
  return {
    tokenId,
    amount: decimalize(bn(amount.toString()), metadata?.decimals),
    metadata
  };
}

const { isLoading, reset: resetScrolling } = useInfiniteScroll(
  useTemplateRef("txEl"),
  fetchConfirmedTransactions,
  { canLoadMore: () => !allLoaded.value, distance: 2_000 }
);

async function fetchConfirmedTransactions() {
  if (!confirmedGenerator.value) {
    allLoaded.value = true;
    return;
  }

  const response = await confirmedGenerator.value.next();
  if (response.done) {
    allLoaded.value = true;
    return;
  }

  const mapped = response.value.map((x) => summarizeTransaction(x, ergoTrees.value));
  confirmed.value = [...confirmed.value, ...mapped];
  if (mapped.length > 0) {
    assets.loadMetadata(mapped.flatMap((x) => x.delta.tokens.map((y) => y.tokenId)));
  }
}

// listening to wallet loading state ensures that wallet is
// fully loaded before fetching transactions
watch(
  () => wallet.loading,
  (loading) => {
    if (loading) return;
    reset();
  }
);

function reset() {
  confirmed.value = [];
  allLoaded.value = false;
  resetScrolling();
}

function getTransactionExplorerUrl(txId: string): string {
  return new URL(`/transactions/${txId}`, app.settings.explorerUrl).toString();
}

function positive(n: BigNumber): BigNumber {
  return n.isNegative() ? n.negated() : n;
}

function cancelTransaction(tx: UnconfirmedTransactionSummary) {
  openTransactionSigningModal({ onTransactionBuild: () => createRBFCancellationTransaction(tx) });
}
</script>

<template>
  <div ref="txEl" class="-mx-4 h-full overflow-y-auto overflow-x-hidden">
    <div class="flex flex-col gap-4 px-4 pt-4 text-sm">
      <div
        v-for="tx in txHistory"
        :key="tx.transactionId"
        class="mb-2 flex flex-col gap-2 rounded border p-4 shadow-sm"
      >
        <div class="mb-2 flex text-xs">
          <div>
            <a
              :href="getTransactionExplorerUrl(tx.transactionId)"
              target="_blank"
              rel="noopener noreferrer"
              ><span class="h-tag bg-gray-100 font-bold">{{
                formatter.string.shorten(tx.transactionId, 20)
              }}</span></a
            >
          </div>
          <div class="w-full text-right">
            <span>{{ formatTimeAgo(new Date(tx.timestamp)) }}</span>
          </div>
        </div>
        <div class="flex flex-col gap-2 p-2">
          <div
            v-for="asset in tx.delta"
            :key="asset.tokenId"
            class="flex flex-row items-center gap-2"
          >
            <upload-icon v-if="asset.amount.isNegative()" class="min-w-4 text-red-500" :size="16" />
            <download-icon v-else class="min-w-4 text-green-500" :size="16" />

            <asset-icon class="h-6 w-6 min-w-6" :token-id="asset.tokenId" />
            <div class="w-full">
              {{ asset.metadata?.name ?? formatter.string.shorten(asset.tokenId, 10) }}
            </div>
            <div>
              {{ formatter.bn.format(positive(asset.amount)) }}
            </div>
          </div>
        </div>
        <div class="mt-2 flex flex-row items-center justify-between gap-2">
          <div class="h-tag">Fee {{ formatter.bn.format(tx.fee) }} ERG</div>
          <div
            class="h-tag font-semibold text-light-200"
            :class="tx.confirmed ? 'bg-green-500' : 'bg-yellow-500'"
          >
            <template v-if="tx.confirmed"
              >{{ (chain.height - tx.height + 1).toLocaleString() }} confirmations</template
            >
            <template v-else>Pending</template>
          </div>
        </div>
        <button
          v-if="!tx.confirmed && tx.cancelable"
          class="btn default mt-4 !py-1"
          @click="cancelTransaction(tx as unknown as UnconfirmedTransactionSummary)"
        >
          Cancel
        </button>
      </div>
    </div>

    <div v-if="isLoading && !allLoaded" class="flex flex-col gap-4 px-4 pt-4 text-sm">
      <div class="mb-2 flex flex-col gap-2 rounded border p-4 shadow-sm">
        <div class="mb-2 flex justify-between">
          <div class="skeleton h-5 w-6/12 rounded"></div>
          <div class="skeleton h-4 w-3/12 rounded"></div>
        </div>
        <div class="flex flex-col gap-2 p-2">
          <div class="flex flex-row items-center gap-2">
            <download-icon class="min-w-4 animate-pulse text-gray-300" :size="16" />

            <empty-logo class="h-7 w-7 min-w-7 animate-pulse fill-gray-300" />
            <div class="skeleton h-4 w-5/12 rounded"></div>
            <div class="w-full"></div>
            <div class="skeleton h-4 w-4/12 rounded"></div>
          </div>
        </div>
        <div class="mt-2 flex flex-row items-center justify-between gap-2">
          <div class="skeleton h-5 w-4/12 rounded"></div>
          <div class="skeleton h-5 w-5/12 rounded"></div>
        </div>
      </div>
    </div>
    <div
      v-else-if="allLoaded && !txHistory?.length"
      class="flex flex-col items-center gap-4 px-4 pt-20 text-center text-gray-500"
    >
      <clock-icon :size="64" class="text-gray-400" />
      You have no transaction history.
    </div>
  </div>
</template>

<style scoped>
.h-tag {
  @apply whitespace-nowrap rounded-md px-2 py-0.5 text-xs ring-1 ring-gray-200;
}
</style>
