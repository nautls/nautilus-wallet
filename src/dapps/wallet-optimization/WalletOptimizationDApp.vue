<script setup lang="ts">
import { fetchBoxes } from "@/api/ergo/boxFetcher";
import store from "@/store";
import { ErgoBox } from "@/types/connector";
import { computed, onMounted, ref, toRaw, watch } from "vue";
import { serializeBox } from "@fleet-sdk/serializer";
import dayjs from "dayjs";
import { minBy } from "lodash-es";
import { graphQLService } from "@/api/explorer/graphQlService";
import { FeeSettings } from "@/types/internal";
import { decimalize } from "@/utils/bigNumbers";
import BigNumber from "bignumber.js";
import {
  BLOCK_TIME_IN_MINUTES,
  ERG_DECIMALS,
  ERG_TOKEN_ID,
  HEALTHY_BLOCKS_AGE,
  SAFE_MIN_FEE_VALUE,
  HEALTHY_UTXO_COUNT
} from "@/constants/ergo";
import FeeSelector from "@/components/FeeSelector.vue";
import { filters } from "@/utils/globalFilters";
import { createConsolidationTransaction } from "./transactionFactory";
import { openTransactionSigningModal } from "@/utils/componentUtils";

const loading = ref(true);
const boxes = ref<ErgoBox[]>([]);
const currentHeight = ref(0);
const fee = ref<FeeSettings>({
  tokenId: ERG_TOKEN_ID,
  value: decimalize(BigNumber(SAFE_MIN_FEE_VALUE), ERG_DECIMALS)
});

onMounted(loadBoxes);
watch(() => store.state.currentWallet.id, loadBoxes);

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
  if (loading.value) {
    return "Loading...";
  }

  if (!minBoxHeight.value) {
    return "N/A";
  }

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
    fetchBoxes(store.state.currentWallet.id),
    graphQLService.getCurrentHeight()
  ]);

  boxes.value = ownBoxes;

  if (height) {
    currentHeight.value = height;
  }

  setLoading(false);
}

function setLoading(load = true) {
  loading.value = load;
}

function successIcon(success: boolean) {
  return success ? "check-circle-outline" : "alert-circle-outline";
}

function successColor(success: boolean) {
  return success ? "text-green-500" : "text-orange-500";
}

function sendTransaction() {
  openTransactionSigningModal({ onTransactionBuild: createTransaction });
}

async function createTransaction() {
  return await createConsolidationTransaction(
    toRaw(boxes.value),
    currentHeight.value,
    store.state.currentWallet.type,
    toRaw(fee.value)
  );
}
</script>

<template>
  <div class="stats">
    <div class="stats-card">
      <div v-if="loading" class="skeleton h-5 w-5 rounded-full m-auto block mb-2"></div>
      <mdi-icon
        v-else
        :name="successIcon(utxoHealth.count)"
        :class="successColor(utxoHealth.count)"
        size="22"
      />

      <p>UTxO count</p>

      <h1 v-if="loading" class="skeleton w-20 h-4 rounded inline-block"></h1>
      <h1 v-else>{{ boxes.length }}</h1>
    </div>
    <div class="stats-card">
      <div v-if="loading" class="skeleton h-5 w-5 rounded-full m-auto block mb-2"></div>
      <mdi-icon
        v-else
        :name="successIcon(utxoHealth.age)"
        :class="successColor(utxoHealth.age)"
        size="22"
      />

      <p>Oldest UTxO</p>

      <h1 v-if="loading" class="skeleton w-20 h-4 rounded inline-block"></h1>
      <h1 v-else>{{ oldestBox }}</h1>
    </div>
    <div class="stats-card">
      <div v-if="loading" class="skeleton h-5 w-5 rounded-full m-auto block mb-2"></div>
      <mdi-icon
        v-else
        :name="successIcon(utxoHealth.size)"
        :class="successColor(utxoHealth.size)"
        size="22"
      />

      <p>Wallet size</p>

      <h1 v-if="loading" class="skeleton w-20 h-4 rounded inline-block"></h1>
      <h1 v-else>{{ filters.formatBytes(size) }}</h1>
    </div>
  </div>
  <div>
    <div class="text-gray-600 text-xs">
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
