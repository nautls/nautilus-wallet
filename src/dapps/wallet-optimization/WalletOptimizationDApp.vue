<script setup lang="ts">
import { computed, onMounted, ref, toRaw } from "vue";
import { Box } from "@fleet-sdk/common";
import { serializeBox } from "@fleet-sdk/serializer";
import dayjs from "dayjs";
import { minBy } from "lodash-es";
import { useAppStore } from "@/stores/appStore";
import { useWalletStore } from "@/stores/walletStore";
import { TransactionFeeConfig, TransactionSignDialog } from "@/components/transaction";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { fetchBoxes } from "@/chains/ergo/boxFetcher";
import { graphQLService } from "@/chains/ergo/services/graphQlService";
import { bn, decimalize } from "@/common/bigNumber";
import { formatDate } from "@/common/dateFormat";
import { useProgrammaticDialog } from "@/composables/useProgrammaticDialog";
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
const app = useAppStore();

const { open: openTransactionSignDialog } = useProgrammaticDialog(TransactionSignDialog);

const loading = ref(true);
const boxes = ref<Box[]>([]);
const currentHeight = ref(0);
const fee = ref<FeeSettings>({
  tokenId: ERG_TOKEN_ID,
  value: decimalize(bn(SAFE_MIN_FEE_VALUE), ERG_DECIMALS)
});

onMounted(loadBoxes);

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
  if (loading.value) return "Loading...";
  if (!minBoxHeight.value) return "N/A";
  return formatDate(
    dayjs().add(-((currentHeight.value - minBoxHeight.value) * BLOCK_TIME_IN_MINUTES), "minutes"),
    { suffixRelativeTime: false }
  );
});

const utxoHealth = computed(() => {
  const count = boxes.value.length < HEALTHY_UTXO_COUNT;
  const age = !minBoxHeight.value || currentHeight.value - minBoxHeight.value < HEALTHY_BLOCKS_AGE;
  const size = walletSize.value < 100_000;
  const overall = count && age && size;

  return { count, age, size, overall };
});

const healthStatus = computed(() => (utxoHealth.value.overall ? "Healthy" : "Unhealthy"));

async function loadBoxes() {
  setLoading(true);

  const [ownBoxes, height] = await Promise.all([
    fetchBoxes(wallet.id, app.settings.zeroConf),
    graphQLService.getHeight()
  ]);
  boxes.value = ownBoxes;
  if (height) currentHeight.value = height;

  setLoading(false);
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
    currentHeight.value,
    wallet.type,
    toRaw(fee.value)
  );
}

function formatBytes(bytes: number, decimals = 1) {
  if (!+bytes) return "0 bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
</script>

<template>
  <div class="flex h-full flex-col gap-4 p-4">
    <div class="grid grid-cols-2 gap-4">
      <DataPoint
        title="UTxO count"
        :loading="loading"
        :healthy="utxoHealth.count"
        :content="boxes.length.toString()"
      />
      <DataPoint
        title="Oldest UTxO"
        :loading="loading"
        :healthy="utxoHealth.age"
        :content="oldestBox"
      />
      <DataPoint
        title="Wallet size"
        :loading="loading"
        :healthy="utxoHealth.size"
        :content="formatBytes(walletSize)"
      />
      <DataPoint
        title="Health"
        :loading="loading"
        :healthy="utxoHealth.overall"
        :content="healthStatus"
      />
    </div>

    <div class="text-xs flex-grow text-muted-foreground">
      Use this tool merge your UTxOs, boosting performance and avoiding
      <Link external href="https://ergoplatform.org/en/blog/2022-02-18-ergo-explainer-storage-rent/"
        >demurrage</Link
      >.
    </div>

    <div class="space-y-4">
      <TransactionFeeConfig v-model="fee" :disabled="loading" />
      <Button :disabled="loading" size="lg" class="w-full" @click="sendTransaction"
        >Optimize</Button
      >
    </div>
  </div>
</template>
