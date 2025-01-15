<script setup lang="ts">
import { computed, onMounted, ref, toRaw } from "vue";
import { Box } from "@fleet-sdk/common";
import { serializeBox } from "@fleet-sdk/serializer";
import { createReusableTemplate } from "@vueuse/core";
import dayjs from "dayjs";
import { minBy } from "lodash-es";
import { CheckIcon, CircleAlertIcon } from "lucide-vue-next";
import { useAppStore } from "@/stores/appStore";
import { useWalletStore } from "@/stores/walletStore";
import FeeSelector from "@/components/FeeSelector.vue";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/components/ui/link";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchBoxes } from "@/chains/ergo/boxFetcher";
import { graphQLService } from "@/chains/ergo/services/graphQlService";
import { bn, decimalize } from "@/common/bigNumber";
import { openTransactionSigningModal } from "@/common/componentUtils";
import {
  BLOCK_TIME_IN_MINUTES,
  ERG_DECIMALS,
  ERG_TOKEN_ID,
  HEALTHY_BLOCKS_AGE,
  HEALTHY_UTXO_COUNT,
  SAFE_MIN_FEE_VALUE
} from "@/constants/ergo";
import { FeeSettings } from "@/types/internal";
import { createConsolidationTransaction } from "./transactionFactory";

const wallet = useWalletStore();
const app = useAppStore();

const loading = ref(true);
const boxes = ref<Box[]>([]);
const currentHeight = ref(0);
const fee = ref<FeeSettings>({
  tokenId: ERG_TOKEN_ID,
  value: decimalize(bn(SAFE_MIN_FEE_VALUE), ERG_DECIMALS)
});

const [DefineDataPoint, DataPoint] = createReusableTemplate<{
  title: string;
  content: string | number;
  healthy: boolean;
}>();

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
  return dayjs()
    .add(-((currentHeight.value - minBoxHeight.value) * BLOCK_TIME_IN_MINUTES), "minutes")
    .fromNow(true);
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

function healthColor(healthy: boolean) {
  return healthy ? "text-green-500/70" : "text-red-500/70";
}

function sendTransaction() {
  openTransactionSigningModal({ onTransactionBuild: createTransaction });
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
  <define-data-point v-slot="{ title, content, healthy }">
    <Card class="w-full">
      <CardHeader class="flex flex-row items-center justify-between space-y-0 p-4 pb-0">
        <CardTitle class="text-xs font-medium">{{ title }}</CardTitle>

        <Skeleton v-if="loading" class="mb-2 inline size-4 rounded-full" />
        <template v-else>
          <CheckIcon v-if="healthy" class="mb-2 inline size-4" :class="healthColor(healthy)" />
          <CircleAlertIcon v-else class="mb-2 inline size-4" :class="healthColor(healthy)" />
        </template>
      </CardHeader>
      <CardContent class="p-4">
        <Skeleton v-if="loading" class="w-8/12 h-7" />
        <div v-else class="text-lg font-bold">{{ content }}</div>
      </CardContent>
    </Card>
  </define-data-point>

  <div class="grid grid-cols-2 gap-4">
    <data-point title="UTxO count" :content="boxes.length" :healthy="utxoHealth.count" />
    <data-point title="Oldest UTxO" :content="oldestBox" :healthy="utxoHealth.age" />
    <data-point title="Wallet size" :content="formatBytes(walletSize)" :healthy="utxoHealth.size" />
    <data-point title="Health" :content="healthStatus" :healthy="utxoHealth.overall" />
  </div>

  <div>
    <div class="text-xs text-muted-foreground">
      <p>
        Use this tool merge your UTxOs, boosting performance and avoiding
        <Link
          external
          href="https://ergoplatform.org/en/blog/2022-02-18-ergo-explainer-storage-rent/"
          >demurrage</Link
        >.
      </p>
    </div>
  </div>

  <div class="flex-grow"></div>

  <FeeSelector v-model="fee" />
  <Button :disabled="loading" size="lg" @click="sendTransaction">Optimize</Button>
</template>
