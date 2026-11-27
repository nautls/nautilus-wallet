<script setup lang="ts">
import {
  ArrowDownRightIcon,
  ArrowUpDownIcon,
  ArrowUpRightIcon,
  ClockIcon,
  EqualIcon
} from "@lucide/vue";
import type BigNumber from "bignumber.js";
import { computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useAppStore } from "@/stores/appStore";
import { useAssetsStore } from "@/stores/assetsStore";
import { useChainStore } from "@/stores/chainStore";
import { AssetIcon } from "@/components/asset";
import HiddenAmount from "@/components/HiddenAmount.vue";
import { TransactionSignDialog, TxActionButton } from "@/components/transaction";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { createRBFCancellationTransaction } from "@/chains/ergo/transaction/builder";
import { bn, decimalize } from "@/common/bigNumber";
import { useFormat, useProgrammaticDialog, useRelativeDateFormatter } from "@/composables";
import { useTxHistory } from "@/composables/useTxHistory";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import type { TransactionSummary } from "@/types/transactions";

const MAX_RELATIVE_TIME = 1_000 * 60 * 60 * 24 * 25; // 25 days
const SETTLED_CONFIRMATIONS = 20;

type Kind = "received" | "sent" | "mixed" | "noChange";

const KIND_ICONS = {
  received: ArrowDownRightIcon,
  sent: ArrowUpRightIcon,
  mixed: ArrowUpDownIcon,
  noChange: EqualIcon
};

const formatter = useFormat();
const { open: openTransactionSignDialog } = useProgrammaticDialog(TransactionSignDialog);

const assets = useAssetsStore();
const chain = useChainStore();
const app = useAppStore();
const { items, loading, available, failed, end, more, retry, chainedOn } = useTxHistory();
const { t, d, n } = useI18n();
const { rd } = useRelativeDateFormatter({ t, d, maxRelativeTime: MAX_RELATIVE_TIME });

const rows = computed(() =>
  items.value.map((tx) => {
    const entries = mapDelta(tx.delta);
    return { tx, entries, kind: kindOf(entries), status: statusOf(tx) };
  })
);

// the rail runs on into the skeletons or the next page while there is more to show
const railEnds = computed(() => end.value && !loading.value);

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

function kindOf(entries: { amount: BigNumber }[]): Kind {
  const out = entries.some((x) => x.amount.isNegative());
  const into = entries.some((x) => !x.amount.isNegative());
  if (out && into) return "mixed";
  if (out) return "sent";
  if (into) return "received";
  return "noChange";
}

function getTransactionExplorerUrl(txId: string): string {
  return new URL(`/transactions/${txId}`, app.settings.explorerUrl).toString();
}

function statusOf(tx: TransactionSummary) {
  const confirmations = tx.height === undefined ? 0 : Math.max(chain.height - tx.height + 1, 1);
  const count = t("transaction.history.txState", { count: n(confirmations) }, confirmations);
  if (!tx.timestamp) return { confirmations, label: count };

  const time = d(tx.timestamp, { dateStyle: "medium", timeStyle: "short" });
  return confirmations >= SETTLED_CONFIRMATIONS
    ? { confirmations, label: rd(tx.timestamp), hint: count }
    : { confirmations, label: count, hint: time };
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
        <TooltipProvider :delay-duration="100">
          <ol v-if="rows.length || loading" class="flex flex-col">
            <li
              v-for="({ tx, entries, kind, status }, i) in rows"
              :key="tx.transactionId"
              :data-tx-id="tx.transactionId"
              class="relative flex gap-3 pb-8 last:pb-0"
            >
              <span
                v-if="i < rows.length - 1 || !railEnds"
                aria-hidden="true"
                class="bg-border absolute top-10 bottom-2 left-4 w-px"
              />

              <div aria-hidden="true" class="relative size-8 shrink-0">
                <span
                  v-if="tx.height === undefined"
                  class="bg-warning/40 motion-safe:animate-ripple absolute inset-0 rounded-full"
                />
                <span
                  class="relative flex size-8 items-center justify-center rounded-full border [&_svg]:size-4"
                  :class="[
                    tx.height === undefined
                      ? 'border-warning bg-background'
                      : 'bg-accent border-transparent',
                    {
                      'text-success': kind === 'received',
                      'text-destructive': kind === 'sent',
                      'text-muted-foreground': kind === 'mixed' || kind === 'noChange'
                    }
                  ]"
                >
                  <component :is="KIND_ICONS[kind]" />
                </span>
              </div>

              <div class="flex min-w-0 grow flex-col">
                <div class="flex items-baseline justify-between gap-2">
                  <p class="text-sm font-semibold">{{ t(`transaction.history.${kind}`) }}</p>
                  <Tooltip :disabled="!status.hint">
                    <TooltipTrigger
                      :data-confirmations="status.confirmations"
                      class="text-muted-foreground cursor-default text-xs whitespace-nowrap"
                      :class="{ 'text-warning font-medium': status.confirmations === 0 }"
                    >
                      {{ status.label }}
                    </TooltipTrigger>
                    <TooltipContent>{{ status.hint }}</TooltipContent>
                  </Tooltip>
                </div>

                <Link
                  class="text-muted-foreground hover:text-foreground self-start text-xs text-nowrap"
                  external
                  :aria-label="
                    t('transaction.history.txTitle', {
                      txId: formatter.string.shorten(tx.transactionId, 7, 'none')
                    })
                  "
                  :href="getTransactionExplorerUrl(tx.transactionId)"
                >
                  {{ formatter.string.shorten(tx.transactionId, 7, "none") }}
                </Link>

                <ul v-if="entries.length" class="mt-3 flex flex-col gap-2">
                  <li
                    v-for="asset in entries"
                    :key="asset.tokenId"
                    class="flex items-center gap-2 text-sm"
                  >
                    <AssetIcon class="size-5 min-w-5" :token-id="asset.tokenId" />
                    <span class="min-w-0 grow truncate">
                      {{ asset.metadata?.name ?? formatter.string.shorten(asset.tokenId, 10) }}
                    </span>
                    <HiddenAmount v-if="app.settings.hideBalances" />
                    <span
                      v-else
                      class="font-medium whitespace-nowrap tabular-nums"
                      :class="{ 'text-success': !asset.amount.isNegative() }"
                    >
                      <span class="mr-px">{{ asset.amount.isNegative() ? "−" : "+" }}</span>
                      <span>{{ formatter.number.decimal(positive(asset.amount)) }}</span>
                    </span>
                  </li>
                </ul>

                <TxActionButton
                  v-if="tx.cancelable"
                  variant="outline"
                  size="sm"
                  class="mt-3 w-auto self-start"
                  @click="cancelTransaction(tx)"
                >
                  {{ t("common.cancel") }}
                </TxActionButton>
              </div>
            </li>

            <template v-if="loading">
              <li
                v-for="i in items.length ? 1 : 5"
                :key="`skeleton-${i}`"
                aria-hidden="true"
                class="relative flex gap-3 pb-8 last:pb-0"
              >
                <span
                  v-if="i < (items.length ? 1 : 5)"
                  class="bg-border absolute top-10 bottom-2 left-4 w-px"
                />
                <Skeleton class="size-8 shrink-0 rounded-full" />
                <div class="flex grow flex-col gap-1.5">
                  <div class="flex justify-between">
                    <Skeleton class="h-4 w-20" />
                    <Skeleton class="h-3.5 w-16" />
                  </div>
                  <Skeleton class="h-3.5 w-20" />
                  <div class="mt-2 flex items-center gap-2">
                    <Skeleton class="size-5 rounded-full" />
                    <Skeleton class="h-4 w-16" />
                    <div class="grow"></div>
                    <Skeleton class="h-4 w-12" />
                  </div>
                </div>
              </li>
            </template>
          </ol>
        </TooltipProvider>

        <template v-if="!loading">
          <div v-if="!available" class="text-muted-foreground mt-28 text-center text-sm">
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

          <Button
            v-else-if="!end"
            id="history-more"
            class="w-full"
            variant="outline"
            @click="more()"
          >
            {{ t("transaction.history.nextPage") }}
          </Button>
        </template>
      </div>
    </Transition>
  </ScrollArea>
</template>
