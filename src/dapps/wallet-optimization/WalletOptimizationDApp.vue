<script setup lang="ts">
import { computed, ref, toRaw, watch } from "vue";
import { Amount, Box } from "@fleet-sdk/common";
import { serializeBox } from "@fleet-sdk/serializer";
import { TriangleAlertIcon } from "@lucide/vue";
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
import { fetchBoxes } from "@/chains/ergo/boxFetcher";
import { log } from "@/common/logger";
import { bn, decimalize } from "@/common/bigNumber";
import { useWalletBoxes } from "@/composables/useWalletBoxes";
import { useProgrammaticDialog, useRelativeDateFormatter } from "@/composables";
import {
  BLOCK_TIME_IN_MINUTES,
  ERG_DECIMALS,
  ERG_TOKEN_ID,
  HEALTHY_BLOCKS_AGE,
  HEALTHY_UTXO_COUNT,
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

const oldestBox = computed(() => {
  if (loading.value || !minBoxHeight.value) return "";

  return rd(new Date().setMinutes(-((chain.height - minBoxHeight.value) * BLOCK_TIME_IN_MINUTES)));
});

const utxoHealth = computed(() => {
  const count = boxes.value.length < HEALTHY_UTXO_COUNT;
  const age = !minBoxHeight.value || chain.height - minBoxHeight.value < HEALTHY_BLOCKS_AGE;
  const size = walletSize.value < 100_000;
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
      <div class="grid grid-cols-2 gap-4">
        <DataPoint
          :title="t('dapps.walletOptimizer.utxoCount')"
          :loading="loading"
          :healthy="utxoHealth.count"
          :content="boxes.length.toString()"
        />
        <DataPoint
          :title="t('dapps.walletOptimizer.oldestUtxo')"
          :loading="loading"
          :healthy="utxoHealth.age"
          :content="oldestBox"
        />
        <DataPoint
          :title="t('dapps.walletOptimizer.walletSize')"
          :loading="loading"
          :healthy="utxoHealth.size"
          :content="formatBytes(walletSize)"
        />
        <DataPoint
          :title="t('dapps.walletOptimizer.walletHealth')"
          :loading="loading"
          :healthy="utxoHealth.overall"
          :content="healthStatus"
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

      <I18nT
        keypath="dapps.walletOptimizer.description"
        tag="div"
        class="text-muted-foreground grow text-xs hyphens-auto"
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
