<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from "vue";
import { BoxSummary, orderBy, uniqBy } from "@fleet-sdk/common";
import { ErgoAddress } from "@fleet-sdk/core";
import type BigNumber from "bignumber.js";
import { CheckIcon, CircleIcon, ClockIcon } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import { useAppStore } from "@/stores/appStore";
import { useAssetsStore } from "@/stores/assetsStore";
import { useChainStore } from "@/stores/chainStore";
import { usePoolStore } from "@/stores/poolStore";
import { useWalletStore } from "@/stores/walletStore";
import { AssetIcon, AssetSignIcon } from "@/components/asset";
import { TransactionSignDialog } from "@/components/transaction";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { graphQLService } from "@/chains/ergo/services/graphQlService";
import { createRBFCancellationTransaction } from "@/chains/ergo/transaction/builder";
import { summarizeTransaction } from "@/chains/ergo/transaction/summarizer";
import { bn, decimalize } from "@/common/bigNumber";
import { useRelativeDateFormatter } from "@/common/dateFormat";
import { useFormat } from "@/composables";
import { useProgrammaticDialog } from "@/composables/useProgrammaticDialog";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import { AddressState } from "@/types/internal";
import type {
  ConfirmedTransactionSummary,
  UnconfirmedTransactionSummary
} from "@/types/transactions";

const MAX_RELATIVE_TIME = 1_000 * 60 * 60 * 24 * 25; // 25 days

const formatter = useFormat();
const { open: openTransactionSignDialog } = useProgrammaticDialog(TransactionSignDialog);

const wallet = useWalletStore();
const assets = useAssetsStore();
const chain = useChainStore();
const app = useAppStore();
const pool = usePoolStore();
const { t, d } = useI18n();
const { rd } = useRelativeDateFormatter({ t, d, maxRelativeTime: MAX_RELATIVE_TIME });

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
  openTransactionSignDialog({ transactionBuilder: () => createRBFCancellationTransaction(tx) });
}
</script>

<template>
  <ScrollArea type="scroll">
    <Transition name="slide-up" appear>
      <div class="flex flex-col gap-6 p-6">
        <Card v-for="tx in txHistory" :key="tx.transactionId" class="cursor-default">
          <CardHeader class="gap-0.5">
            <CardTitle class="flex flex-row items-center justify-between">
              <Link class="text-sm" external :href="getTransactionExplorerUrl(tx.transactionId)">
                {{
                  t("history.txTitle", {
                    txId: formatter.string.shorten(tx.transactionId, 7, "none")
                  })
                }}
              </Link>
              <span class="text-xs font-normal">{{ rd(tx.timestamp) }}</span>
            </CardTitle>
            <CardDescription class="text-xs">
              <div>
                {{ t("history.txState", tx.confirmed ? chain.height - tx.height + 1 : 0) }}
                <CheckIcon v-if="tx.confirmed" class="text-success -ml-1 inline-flex h-3.5" />
                <CircleIcon
                  v-else
                  class="fill-warning text-warning -ml-1 inline-flex h-3.5 animate-pulse"
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
              <AssetSignIcon :type="asset.amount.isNegative() ? 'negative' : 'positive'" />

              <AssetIcon class="ml-2 h-6 w-6 min-w-6" :token-id="asset.tokenId" />
              <div class="w-full">
                {{ asset.metadata?.name ?? formatter.string.shorten(asset.tokenId, 10) }}
              </div>
              <div>
                <Skeleton v-if="app.settings.hideBalances" class="h-5 w-16" />
                <template v-else>{{ formatter.bn.format(positive(asset.amount)) }}</template>
              </div>
            </div>
          </CardContent>

          <CardFooter v-if="!tx.confirmed && tx.cancelable">
            <Button
              class="w-full"
              variant="outline"
              @click="cancelTransaction(tx as unknown as UnconfirmedTransactionSummary)"
            >
              {{ t("common.cancel") }}
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
                <Skeleton class="h-5 w-5 rounded-full border" />
                <Skeleton class="ml-2 h-6 w-6" />
                <Skeleton class="h-5 w-24" />
                <div class="grow"></div>
                <Skeleton class="h-5 w-16" />
              </div>
            </CardContent>
          </Card>
        </template>

        <div
          v-else-if="loaded && !txHistory?.length"
          class="text-muted-foreground flex flex-col items-center gap-4 text-center text-sm"
        >
          <ClockIcon :size="48" class="stroke-[1.5px]" />
          {{ t("history.empty") }}
        </div>

        <Button
          v-else-if="!loaded && !loading"
          class="w-full"
          variant="outline"
          @click="fetchConfirmedTransactions"
        >
          {{ t("history.paginateAhead") }}
        </Button>
      </div>
    </Transition>
  </ScrollArea>
</template>
