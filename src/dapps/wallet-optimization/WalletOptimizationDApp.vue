<script setup lang="ts">
import { computed, onMounted, ref, toRaw, watch } from "vue";
import { Box } from "@fleet-sdk/common";
import { serializeBox } from "@fleet-sdk/serializer";
import { createReusableTemplate } from "@vueuse/core";
import dayjs from "dayjs";
import { minBy } from "lodash-es";
import { AlertCircleIcon, CircleCheckIcon } from "lucide-vue-next";
import { useAppStore } from "@/stores/appStore";
import { useWalletStore } from "@/stores/walletStore";
import FeeSelector from "@/components/FeeSelector.vue";
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
watch(() => wallet.id, loadBoxes);

const size = computed(() => {
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
  return {
    count: boxes.value.length < HEALTHY_UTXO_COUNT,
    age: !minBoxHeight.value || currentHeight.value - minBoxHeight.value < HEALTHY_BLOCKS_AGE,
    size: size.value < 100_000
  };
});

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

function successColor(success: boolean) {
  return success ? "text-green-500" : "text-orange-500";
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
    <div class="stats-card">
      <div v-if="loading" class="skeleton m-auto mb-2 block h-5 w-5 rounded-full"></div>
      <template v-else>
        <circle-check-icon
          v-if="healthy"
          class="mb-2 inline h-5 w-5"
          :class="successColor(healthy)"
        />
        <alert-circle-icon v-else class="mb-2 inline h-5 w-5" :class="successColor(healthy)" />
      </template>

      <p>{{ title }}</p>

      <h1 v-if="loading" class="skeleton inline-block h-4 w-20 rounded"></h1>
      <h1 v-else>{{ content }}</h1>
    </div>
  </define-data-point>

  <div class="stats">
    <data-point title="UTxO count" :content="boxes.length" :healthy="utxoHealth.count" />
    <data-point title="Oldest UTxO" :content="oldestBox" :healthy="utxoHealth.age" />
    <data-point title="Wallet size" :content="formatBytes(size)" :healthy="utxoHealth.size" />
  </div>
  <div>
    <div class="text-xs text-gray-600">
      <p>
        The Wallet Optimization Tool aims to renew and consolidate your UTxOs (Unspent Transaction
        Outputs) into a smaller number of new UTxOs. By doing so, it enhances the performance of
        your wallet and dApp interactions while avoiding
        <a
          class="link text-blue-600"
          target="_blank"
          rel="noopener noreferrer"
          href="https://ergoplatform.org/en/blog/2022-02-18-ergo-explainer-storage-rent/"
          >storage rent</a
        >.
      </p>
    </div>
  </div>
  <div class="flex-grow"></div>
  <fee-selector v-model:selected="fee" />
  <button :disabled="loading" class="btn w-full" @click="sendTransaction">Optimize</button>
</template>
