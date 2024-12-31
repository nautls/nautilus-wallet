<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from "vue";
import { BoxSummary, orderBy, uniqBy } from "@fleet-sdk/common";
import { ErgoAddress } from "@fleet-sdk/core";
import { formatTimeAgo } from "@vueuse/core";
import type { BigNumber } from "bignumber.js";
import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  CircleCheckBigIcon,
  CircleIcon,
  ClockIcon
} from "lucide-vue-next";
import { useAppStore } from "@/stores/appStore";
import { useAssetsStore } from "@/stores/assetsStore";
import { useChainStore } from "@/stores/chainStore";
import { usePoolStore } from "@/stores/poolStore";
import { useWalletStore } from "@/stores/walletStore";
import AssetIcon from "@/components/AssetIcon.vue";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Link } from "@/components/ui/link";
import { Skeleton } from "@/components/ui/skeleton";
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
const loaded = ref(false);
const loading = ref(true);

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

onMounted(fetchConfirmedTransactions);

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

async function fetchConfirmedTransactions() {
  if (!confirmedGenerator.value) return (loaded.value = true);

  loading.value = true;
  const response = await confirmedGenerator.value.next();
  if (response.done) return (loaded.value = true);

  const mapped = response.value.map((x) => summarizeTransaction(x, ergoTrees.value));
  confirmed.value = [...confirmed.value, ...mapped];
  if (mapped.length > 0) {
    assets.loadMetadata(mapped.flatMap((x) => x.delta.tokens.map((y) => y.tokenId)));
  }

  loading.value = false;
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
  <div class="p-4 flex flex-col gap-4">
    <Card v-for="tx in txHistory" :key="tx.transactionId" class="cursor-default">
      <CardHeader class="gap-0.5">
        <CardTitle class="flex flex-row items-center justify-between">
          <Link class="text-sm" external :href="getTransactionExplorerUrl(tx.transactionId)">
            Transaction {{ formatter.string.shorten(tx.transactionId, 7, "none") }}
          </Link>
          <span class="font-normal text-xs">{{ formatTimeAgo(new Date(tx.timestamp)) }}</span>
        </CardTitle>
        <CardDescription class="text-xs">
          <div v-if="tx.confirmed">
            {{ (chain.height - tx.height + 1).toLocaleString() }} confirmations
            <CircleCheckBigIcon class="h-3 -ml-1 inline-flex text-green-600" />
          </div>
          <div v-else>
            Pending
            <CircleIcon
              class="h-3 -ml-1 inline-flex text-yellow-600 animate-pulse fill-yellow-600"
            />
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-2 text-sm">
        <div
          v-for="asset in tx.delta"
          :key="asset.tokenId"
          class="flex flex-row items-center gap-2"
        >
          <ArrowUpRightIcon
            v-if="asset.amount.isNegative()"
            class="min-w-5 h-auto text-red-700 opacity-60 rounded-full p-1 bg-red-200"
            :size="16"
          />
          <ArrowDownRightIcon
            v-else
            class="min-w-5 h-auto text-green-700 opacity-60 rounded-full p-1 bg-green-200"
            :size="16"
          />

          <asset-icon class="h-6 w-6 min-w-6 ml-2" :token-id="asset.tokenId" />
          <div class="w-full">
            {{ asset.metadata?.name ?? formatter.string.shorten(asset.tokenId, 10) }}
          </div>
          <div>
            {{ formatter.bn.format(positive(asset.amount)) }}
          </div>
        </div>
      </CardContent>

      <CardFooter v-if="!tx.confirmed && tx.cancelable">
        <Button
          class="w-full"
          variant="outline"
          @click="cancelTransaction(tx as unknown as UnconfirmedTransactionSummary)"
        >
          Cancel
        </Button>
      </CardFooter>
    </Card>

    <template v-if="loading && !loaded">
      <Card v-for="i in txHistory?.length ? 1 : 5" :key="i" class="cursor-default">
        <CardHeader class="gap-0.5">
          <CardTitle class="flex flex-row items-center justify-between">
            <Skeleton class="h-5 w-36" />
            <Skeleton class="h-4 w-20" />
          </CardTitle>
          <CardDescription class="text-xs">
            <Skeleton class="h-4 w-28" />
          </CardDescription>
        </CardHeader>
        <CardContent class="flex flex-col gap-2">
          <div class="flex flex-row items-center gap-2">
            <Skeleton class="h-5 w-5 rounded-full" />
            <Skeleton class="h-6 w-6 ml-2" />
            <Skeleton class="h-5 w-24" />
            <div class="flex-grow"></div>
            <Skeleton class="h-5 w-14" />
          </div>
        </CardContent>
      </Card>
    </template>

    <div
      v-else-if="loaded && !txHistory?.length"
      class="flex flex-col items-center gap-4 text-center text-muted-foreground text-sm"
    >
      <clock-icon :size="48" />
      You have no transaction history yet.
    </div>

    <Button
      v-else-if="!loaded && !loading"
      class="w-full"
      variant="outline"
      @click="fetchConfirmedTransactions"
    >
      Load more transactions...
    </Button>
  </div>
</template>
