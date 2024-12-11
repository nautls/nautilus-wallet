<script setup lang="ts">
import { computed, ref, shallowRef, useTemplateRef, watch } from "vue";
import { BoxSummary, orderBy, uniqBy } from "@fleet-sdk/common";
import type { BigNumber } from "bignumber.js";
import { ErgoAddress } from "@fleet-sdk/core";
import { formatTimeAgo, useInfiniteScroll } from "@vueuse/core";
import EmptyLogo from "@/assets/images/tokens/asset-empty.svg";
import { useWalletStore } from "@/stores/walletStore";
import { graphQLService } from "@/chains/ergo/services/graphQlService";
import { bn, decimalize } from "@/common/bigNumber";
import { useFormat } from "@/composables";
import { useAssetsStore } from "@/stores/assetsStore";
import { AddressState } from "@/types/internal";
import { useChainStore } from "@/stores/chainStore";
import { useAppStore } from "@/stores/appStore";
import type {
  ConfirmedTransactionSummary,
  UnconfirmedTransactionSummary
} from "@/types/transactions";
import { summarizeTransaction } from "@/chains/ergo/transaction/interpreter/utils";
import { usePoolStore } from "@/stores/poolStore";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import { openTransactionSigningModal } from "@/common/componentUtils";
import { createRBFCancellationTransaction } from "@/chains/ergo/transaction/txBuilder";

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
  <div ref="txEl" class="-mx-4 overflow-y-auto overflow-x-hidden h-full">
    <div class="flex flex-col gap-4 text-sm pt-4 px-4">
      <div
        v-for="tx in txHistory"
        :key="tx.transactionId"
        class="flex flex-col gap-2 mb-2 shadow-sm border rounded p-4"
      >
        <div class="flex text-xs mb-2">
          <div>
            <a
              :href="getTransactionExplorerUrl(tx.transactionId)"
              target="_blank"
              rel="noopener noreferrer"
              ><span class="h-tag font-bold bg-gray-100">{{
                formatter.string.shorten(tx.transactionId, 20)
              }}</span></a
            >
          </div>
          <div class="text-right w-full">
            <span>{{ formatTimeAgo(new Date(tx.timestamp)) }}</span>
          </div>
        </div>
        <div class="p-2 flex flex-col gap-2">
          <div
            v-for="asset in tx.delta"
            :key="asset.tokenId"
            class="flex flex-row items-center gap-2"
          >
            <vue-feather
              v-if="asset.amount.isNegative()"
              type="corner-left-up"
              class="min-w-4 text-red-500"
              size="16"
            />
            <vue-feather v-else type="corner-right-down" class="min-w-4 text-green-500" size="16" />
            <asset-icon class="h-6 w-6 min-w-6" :token-id="asset.tokenId" />
            <div class="w-full">
              {{ asset.metadata?.name ?? formatter.string.shorten(asset.tokenId, 10) }}
            </div>
            <div>
              {{ formatter.bn.format(positive(asset.amount)) }}
            </div>
          </div>
        </div>
        <div class="flex flex-row items-center gap-2 justify-between mt-2">
          <div class="h-tag">Fee {{ formatter.bn.format(tx.fee) }} ERG</div>
          <div
            class="h-tag text-light-200 font-semibold"
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
          @click="cancelTransaction(tx as unknown as UnconfirmedTransactionSummary)"
          class="btn default !py-1 mt-4"
        >
          Cancel
        </button>
      </div>
    </div>

    <div v-if="isLoading && !allLoaded" class="flex flex-col gap-4 text-sm pt-4 px-4">
      <div class="flex flex-col gap-2 mb-2 shadow-sm border rounded p-4">
        <div class="flex mb-2 justify-between">
          <div class="skeleton h-5 w-6/12 rounded"></div>
          <div class="skeleton h-4 rounded w-3/12"></div>
        </div>
        <div class="p-2 flex flex-col gap-2">
          <div class="flex flex-row items-center gap-2">
            <vue-feather
              type="corner-right-down"
              class="min-w-4 text-gray-300 animate-pulse"
              size="16"
            />
            <empty-logo class="h-7 w-7 min-w-7 animate-pulse fill-gray-300" />
            <div class="skeleton h-4 rounded w-5/12"></div>
            <div class="w-full"></div>
            <div class="skeleton h-4 rounded w-4/12"></div>
          </div>
        </div>
        <div class="flex flex-row items-center gap-2 justify-between mt-2">
          <div class="skeleton h-5 w-4/12 rounded"></div>
          <div class="skeleton h-5 w-5/12 rounded"></div>
        </div>
      </div>
    </div>
    <div
      v-else-if="allLoaded && !txHistory?.length"
      class="flex flex-col gap-4 pt-20 px-4 text-center items-center text-gray-500"
    >
      <vue-feather type="clock" size="64" class="text-gray-400" />
      You have no transaction history.
    </div>
  </div>
</template>

<style scoped>
.h-tag {
  @apply rounded-md px-2 py-0.5 ring-1 ring-gray-200 text-xs whitespace-nowrap;
}
</style>
