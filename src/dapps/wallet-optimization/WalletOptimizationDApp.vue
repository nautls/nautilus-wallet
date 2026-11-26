<script setup lang="ts">
import { computed, ref, toRaw, watch } from "vue";
import { Amount, Box } from "@fleet-sdk/common";
import { serializeBox } from "@fleet-sdk/serializer";
import { ShieldAlertIcon, ShieldCheckIcon, TriangleAlertIcon } from "@lucide/vue";
import { minBy } from "es-toolkit";
import { I18nT, useI18n } from "vue-i18n";
import { useChainStore } from "@/stores/chainStore";
import { useWalletStore } from "@/stores/walletStore";
import ActionFooter from "@/components/ActionFooter.vue";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  TransactionFeeConfig,
  TransactionSignDialog,
  TxActionButton
} from "@/components/transaction";
import { Link } from "@/components/ui/link";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchBoxes } from "@/chains/ergo/boxFetcher";
import { log } from "@/common/logger";
import { bn, decimalize } from "@/common/bigNumber";
import { useWalletBoxes } from "@/composables/useWalletBoxes";
import { useProgrammaticDialog, useRelativeDateFormatter } from "@/composables";
import {
  BLOCK_TIME_IN_MINUTES,
  BLOCKS_IN_A_YEAR,
  ERG_DECIMALS,
  ERG_TOKEN_ID,
  HEALTHY_BLOCKS_AGE,
  HEALTHY_UTXO_COUNT,
  HEALTHY_WALLET_SIZE,
  SAFE_MIN_FEE_VALUE
} from "@/constants/ergo";
import { FeeSettings } from "@/types/internal";
import DataPoint from "./components/DataPoint.vue";
import { createConsolidationTransaction } from "./transactionFactory";

const wallet = useWalletStore();
const walletBoxes = useWalletBoxes();
const chain = useChainStore();

const { t, d } = useI18n();
const { rd } = useRelativeDateFormatter({ t, d, showRelativeTimeQualifier: false });
const { open: openTransactionSignDialog } = useProgrammaticDialog(TransactionSignDialog);

const loading = ref(true);
const boxes = ref<Box<Amount>[]>([]);
const fee = ref<FeeSettings>({
  tokenId: ERG_TOKEN_ID,
  value: decimalize(bn(SAFE_MIN_FEE_VALUE), ERG_DECIMALS)
});

const walletSize = computed(() => {
  let size = 0;
  for (const box of boxes.value) {
    size += serializeBox(box).length;
  }

  return size;
});

const minBoxHeight = computed(() => {
  return minBy(boxes.value, (box) => box.creationHeight)?.creationHeight;
});

const healthyYears = HEALTHY_BLOCKS_AGE / BLOCKS_IN_A_YEAR;

const boxAge = computed(() => (minBoxHeight.value ? chain.height - minBoxHeight.value : 0));

const oldestBox = computed(() => {
  if (loading.value || !minBoxHeight.value) return "";

  const years = Math.floor(boxAge.value / BLOCKS_IN_A_YEAR);
  if (years < 1) return rd(Date.now() - boxAge.value * BLOCK_TIME_IN_MINUTES * 60_000);
  if (!utxoHealth.value.age && years <= healthyYears) {
    return t("dapps.walletOptimizer.overYears", healthyYears);
  }

  return t("datetime.years", years);
});

const utxoHealth = computed(() => {
  const count = boxes.value.length < HEALTHY_UTXO_COUNT;
  const age = boxAge.value < HEALTHY_BLOCKS_AGE;
  const size = walletSize.value < HEALTHY_WALLET_SIZE;
  const overall = count && age && size;

  return { count, age, size, overall };
});

const restFallback = computed(
  () => walletBoxes.status === "error" && walletBoxes.error?.code === "too_many_boxes"
);

const healthStatus = computed(() =>
  utxoHealth.value.overall ? t("common.healthy") : t("common.unhealthy")
);

let reads = 0;
watch(
  [() => walletBoxes.status, () => walletBoxes.version],
  async ([status], previous) => {
    // the REST read doesn't follow the chain, so it's taken once per refusal
    if (status === "error" && previous?.[0] === "error") return;

    // any change outdates a read still on its way, which may be of the previous wallet
    const read = ++reads;
    if (status === "idle" || status === "loading") setLoading(true);
    if (status !== "ready" && status !== "error") return;

    const result = await readBoxes(status === "ready");
    if (read !== reads) return;
    boxes.value = result;
    setLoading(false);
  },
  { immediate: true }
);

/**
 * A wallet with too many boxes for the relay to follow, the very one this dApp is for, is read
 * once over REST, cut at the relay's limit; so is one whose followed boxes can't be read.
 */
async function readBoxes(followed: boolean): Promise<Box<Amount>[]> {
  try {
    if (followed) return (await walletBoxes.spendable()).all;
    log.error("Failed to follow the wallet's boxes", walletBoxes.error);
  } catch (e) {
    log.error("Failed to read the wallet's followed boxes", e);
  }

  try {
    return await fetchBoxes(wallet.id);
  } catch (e) {
    log.error("Failed to read the wallet's boxes", e);
    return [];
  }
}

function setLoading(load = true) {
  loading.value = load;
}

function sendTransaction() {
  openTransactionSignDialog({ transactionBuilder: createTransaction });
}

async function createTransaction() {
  return createConsolidationTransaction(
    toRaw(boxes.value),
    chain.height,
    wallet.type,
    toRaw(fee.value)
  );
}

function formatBytes(bytes: number, decimals = 1) {
  const b = t("dapps.walletOptimizer.bytes");
  if (!+bytes) return b;

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = [b, "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="flex min-h-0 grow flex-col gap-4 overflow-y-auto p-4">
      <section
        class="flex items-start gap-3"
        :aria-label="t('dapps.walletOptimizer.walletHealth')"
        aria-live="polite"
      >
        <Skeleton v-if="loading" class="size-10 shrink-0 rounded-full" />
        <div
          v-else
          class="flex size-10 shrink-0 items-center justify-center rounded-full"
          :class="
            utxoHealth.overall ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
          "
        >
          <ShieldCheckIcon v-if="utxoHealth.overall" class="size-5" />
          <ShieldAlertIcon v-else class="size-5" />
        </div>

        <div class="flex min-w-0 flex-col gap-1">
          <Skeleton v-if="loading" class="mt-0.5 h-5 w-24" />
          <h2 v-else class="text-lg leading-tight font-semibold">{{ healthStatus }}</h2>
          <I18nT
            keypath="dapps.walletOptimizer.description"
            tag="p"
            class="text-muted-foreground text-xs"
            scope="global"
          >
            <template #demurrage>
              <Link
                external
                href="https://ergoplatform.org/en/blog/2022-02-18-ergo-explainer-storage-rent/"
                >{{ t("dapps.walletOptimizer.demurrage") }}</Link
              >
            </template>
          </I18nT>
        </div>
      </section>

      <div class="flex flex-col gap-2">
        <DataPoint
          :title="t('dapps.walletOptimizer.utxoCount')"
          :loading="loading"
          :healthy="utxoHealth.count"
          :content="boxes.length.toString()"
          :limit="t('dapps.walletOptimizer.countLimit', { count: HEALTHY_UTXO_COUNT })"
        />
        <DataPoint
          :title="t('dapps.walletOptimizer.oldestUtxo')"
          :loading="loading"
          :healthy="utxoHealth.age"
          :content="oldestBox"
          :limit="t('dapps.walletOptimizer.ageLimit', healthyYears)"
        />
        <DataPoint
          :title="t('dapps.walletOptimizer.walletSize')"
          :loading="loading"
          :healthy="utxoHealth.size"
          :content="formatBytes(walletSize)"
          :limit="t('dapps.walletOptimizer.sizeLimit', { size: formatBytes(HEALTHY_WALLET_SIZE) })"
        />
      </div>

      <Alert
        v-if="restFallback"
        id="rest-fallback-alert"
        class="border-warning [&>svg]:text-warning"
      >
        <TriangleAlertIcon />
        <AlertDescription>
          {{ t("dapps.walletOptimizer.restFallback") }}
        </AlertDescription>
      </Alert>
    </div>

    <ActionFooter>
      <TransactionFeeConfig v-model="fee" :disabled="loading" />
      <TxActionButton
        :disabled="loading || boxes.length === 0"
        allow-rest-fallback
        @click="sendTransaction"
        >{{ t("common.optimize") }}</TxActionButton
      >
    </ActionFooter>
  </div>
</template>
