<script setup lang="ts">
import { CheckIcon, CircleIcon, ClockIcon } from "@lucide/vue";
import type BigNumber from "bignumber.js";
import { watch } from "vue";
import { useI18n } from "vue-i18n";
import { useAppStore } from "@/stores/appStore";
import { useAssetsStore } from "@/stores/assetsStore";
import { useChainStore } from "@/stores/chainStore";
import { AssetIcon, AssetSignIcon } from "@/components/asset";
import HiddenAmount from "@/components/HiddenAmount.vue";
import { TransactionSignDialog, TxActionButton } from "@/components/transaction";
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
import { createRBFCancellationTransaction } from "@/chains/ergo/transaction/builder";
import { bn, decimalize } from "@/common/bigNumber";
import { useFormat, useProgrammaticDialog, useRelativeDateFormatter } from "@/composables";
import { useTxHistory } from "@/composables/useTxHistory";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import type { TransactionSummary } from "@/types/transactions";

const MAX_RELATIVE_TIME = 1_000 * 60 * 60 * 24 * 25; // 25 days

const formatter = useFormat();
const { open: openTransactionSignDialog } = useProgrammaticDialog(TransactionSignDialog);

const assets = useAssetsStore();
const chain = useChainStore();
const app = useAppStore();
const { items, loading, available, failed, end, more, retry, chainedOn } = useTxHistory();
const { t, d } = useI18n();
const { rd } = useRelativeDateFormatter({ t, d, maxRelativeTime: MAX_RELATIVE_TIME });

watch(
  items,
  (items) => {
    const tokenIds = items.flatMap((x) => [...x.delta.tokens.keys()]);
    if (tokenIds.length > 0) assets.loadMetadata(tokenIds);
  },
  { immediate: true }
);

function mapDelta(delta: TransactionSummary["delta"]) {
  const tokens = [...delta.tokens].map(([tokenId, amount]) => token(tokenId, amount));
  return delta.nanoErgs === 0n ? tokens : [token(ERG_TOKEN_ID, delta.nanoErgs), ...tokens];
}

function token(tokenId: string, amount: bigint) {
  const metadata = assets.metadata.get(tokenId);
  return {
    tokenId,
    amount: decimalize(bn(amount.toString()), metadata?.decimals),
    metadata
  };
}

function getTransactionExplorerUrl(txId: string): string {
  return new URL(`/transactions/${txId}`, app.settings.explorerUrl).toString();
}

function positive(n: BigNumber): BigNumber {
  return n.isNegative() ? n.negated() : n;
}

function cancelTransaction(tx: TransactionSummary) {
  const shorten = (txId: string) => formatter.string.shorten(txId, 7, "none");
  const chained = chainedOn(tx.transactionId);
  const txIds = chained.map(shorten).join(", ");

  openTransactionSignDialog({
    transactionBuilder: () => createRBFCancellationTransaction(tx.transactionId),
    notice: t("transaction.history.cancelNotice", { txId: shorten(tx.transactionId) }),
    warning: chained.length
      ? t("transaction.history.cancelsChained", { count: chained.length, txIds }, chained.length)
      : undefined
  });
}
</script>

<template>
  <ScrollArea type="scroll">
    <Transition name="slide-up" appear>
      <div class="flex flex-col gap-4 p-4">
        <Card
          v-for="tx in items"
          :key="tx.transactionId"
          :data-tx-id="tx.transactionId"
          class="cursor-default"
        >
          <CardHeader class="gap-0.5">
            <CardTitle class="flex flex-row items-center justify-between">
              <Link
                class="text-sm text-nowrap"
                external
                :href="getTransactionExplorerUrl(tx.transactionId)"
              >
                {{
                  t("transaction.history.txTitle", {
                    txId: formatter.string.shorten(tx.transactionId, 7, "none")
                  })
                }}
              </Link>
              <span v-if="tx.timestamp" class="text-xs font-normal">{{ rd(tx.timestamp) }}</span>
            </CardTitle>
            <CardDescription class="text-xs">
              <div>
                {{
                  t(
                    "transaction.history.txState",
                    tx.height === undefined ? 0 : Math.max(chain.height - tx.height + 1, 1)
                  )
                }}
                <CheckIcon
                  v-if="tx.height !== undefined"
                  class="text-success -ml-1 inline-flex h-3.5"
                />
                <CircleIcon
                  v-else
                  class="fill-warning text-warning -ml-1 inline-flex h-3.5 animate-pulse"
                />
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent class="flex flex-col gap-2 text-sm">
            <div
              v-for="asset in mapDelta(tx.delta)"
              :key="asset.tokenId"
              class="flex flex-row items-center gap-2"
            >
              <AssetSignIcon :type="asset.amount.isNegative() ? 'negative' : 'positive'" />

              <AssetIcon class="ml-2 h-6 w-6 min-w-6" :token-id="asset.tokenId" />
              <div class="w-full">
                {{ asset.metadata?.name ?? formatter.string.shorten(asset.tokenId, 10) }}
              </div>
              <div>
                <HiddenAmount v-if="app.settings.hideBalances" />
                <template v-else>{{ formatter.number.decimal(positive(asset.amount)) }}</template>
              </div>
            </div>
          </CardContent>

          <CardFooter v-if="tx.cancelable">
            <TxActionButton variant="outline" size="default" @click="cancelTransaction(tx)">
              {{ t("common.cancel") }}
            </TxActionButton>
          </CardFooter>
        </Card>

        <template v-if="loading">
          <Card v-for="i in items.length ? 1 : 5" :key="i" class="cursor-default">
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

        <div v-else-if="!available" class="text-muted-foreground mt-28 text-center text-sm">
          {{ t("transaction.history.noRelay") }}
        </div>

        <template v-else-if="failed">
          <p class="text-muted-foreground text-center text-sm">
            {{ t("transaction.history.loadError") }}
          </p>
          <Button id="history-retry" class="w-full" variant="outline" @click="retry()">
            {{ t("common.tryAgain") }}
          </Button>
        </template>

        <div
          v-else-if="end && !items.length"
          class="text-muted-foreground mt-28 flex flex-col items-center gap-4 text-center text-sm"
        >
          <ClockIcon :size="48" class="stroke-[1.5px]" />
          {{ t("transaction.history.empty") }}
        </div>

        <Button v-else-if="!end" id="history-more" class="w-full" variant="outline" @click="more()">
          {{ t("transaction.history.nextPage") }}
        </Button>
      </div>
    </Transition>
  </ScrollArea>
</template>
