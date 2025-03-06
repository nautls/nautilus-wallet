<script setup lang="ts">
import { computed, nextTick, onMounted, Ref, ref, shallowRef, triggerRef, watch } from "vue";
import { SigmaUSDBank } from "@fleet-sdk/ageusd-plugin";
import { pausableWatch } from "@vueuse/core";
import { BigNumber } from "bignumber.js";
import { ArrowDownUpIcon, ChevronDownIcon, LandmarkIcon } from "lucide-vue-next";
import { useWalletStore } from "@/stores/walletStore";
import { Button } from "@/components/ui/button";
import { StatsCard } from "@/components/ui/stats-card";
import { bn, decimalize } from "@/common/bigNumber";
import { useFormat } from "@/composables";
import { AssetInfo } from "@/types/internal";
import { getBankBox, getOracleBox } from "./blockchainService";
import { Asset, AssetInputSelect } from "./components";
import { ERG_INFO, SIGSRV_INFO, SIGUSD_INFO } from "./metadata";

const wallet = useWalletStore();
const format = useFormat();

const bank = shallowRef<SigmaUSDBank | null>(null);
const loading = ref(false);
const lastChanged = ref<"from" | "to">("from");

const fromAsset = ref<Asset | undefined>(asset("sell", ERG_INFO));
const fromAmount = ref<BigNumber | undefined>();
const toAsset = ref<Asset | undefined>();
const toAmount = ref<BigNumber | undefined>();
const rate = computed(() =>
  toAsset.value && fromAsset.value
    ? toAsset.value.tokenId === ERG_INFO.tokenId
      ? bn(1).div(getRate(fromAsset.value))
      : getRate(toAsset.value)
    : undefined
);

const fromAssets = computed(() => [
  asset("sell", ERG_INFO, toAsset),
  asset("sell", SIGUSD_INFO, toAsset),
  asset("sell", SIGSRV_INFO, toAsset)
]);

const toAssets = computed(() => [
  asset("buy", ERG_INFO, fromAsset),
  asset("buy", SIGUSD_INFO, fromAsset),
  asset("buy", SIGSRV_INFO, fromAsset)
]);

const bankInfo = computed(() => {
  return {
    reserveRatio: Number(bank.value?.reserveRatio ?? 0),
    baseReserves: decimalize(
      bn(bank.value?.baseReserves.toString() ?? 0),
      ERG_INFO.metadata?.decimals
    )
  };
});

onMounted(async () => {
  loading.value = true;
  await fetchBoxes();
  loading.value = false;
});

watch(fromAsset, () => convert(lastChanged.value, false));
watch(toAsset, () => convert(lastChanged.value, false));
const fromWatcher = pausableWatch(fromAmount, () => convert("from"));
const toWatcher = pausableWatch(toAmount, () => convert("to"));

async function convert(source: "from" | "to", retainSourceInfo = true) {
  if (!bank.value) return;

  const sourceAsset = source === "from" ? fromAsset.value : toAsset.value;
  const targetAsset = source === "from" ? toAsset.value : fromAsset.value;
  const sourceAmount = source === "from" ? fromAmount.value : toAmount.value;
  const targetAmount = source === "from" ? toAmount : fromAmount;
  const targetWatcher = source === "from" ? toWatcher : fromWatcher;

  console.log(source);

  if (!sourceAsset || !targetAsset) return;
  if (sourceAsset.tokenId === targetAsset.tokenId) return;

  console.log("converting...");
  try {
    targetWatcher.pause();

    await nextTick(() => {
      if (!sourceAmount || sourceAmount.isZero()) {
        targetAmount.value = bn(0);
        return;
      }

      if (sourceAsset.tokenId === ERG_INFO.tokenId) {
        targetAmount.value = sourceAmount.times(getRate(targetAsset));
      } else {
        targetAmount.value = sourceAmount.div(getRate(sourceAsset));
      }
    });
  } finally {
    if (retainSourceInfo) lastChanged.value = source;
    targetWatcher.resume();
  }
}

function getRate(asset: Asset): BigNumber {
  if (!bank.value) return bn(0);
  if (asset.tokenId === ERG_INFO.tokenId) return bn(1);
  if (asset.tokenId === SIGSRV_INFO.tokenId) return bn(bank.value.reserveCoinErgRate.toString());
  if (asset.tokenId === SIGUSD_INFO.tokenId)
    return decimalize(bn(bank.value.stableCoinErgRate.toString()), SIGUSD_INFO.metadata?.decimals);
  return bn(0);
}

async function fetchBoxes() {
  const [bankBox, oracleBox] = await Promise.all([getBankBox(), getOracleBox()]);

  if (!bank.value) {
    if (!bankBox || !oracleBox) return;
    bank.value = new SigmaUSDBank(bankBox, oracleBox);
    return;
  }

  if (bankBox) bank.value.bankBox = bankBox;
  if (oracleBox) bank.value.oracleBox = oracleBox;
  triggerRef(bank);
}

function asset(
  action: "buy" | "sell",
  asset: AssetInfo,
  oddSelection?: Ref<Asset | undefined>
): Asset {
  return {
    ...asset,
    disabled: !can(action, asset, oddSelection?.value),
    balance: wallet.balance.find((b) => b.tokenId === asset.tokenId)?.balance ?? bn(0)
  };
}

function can(action: "buy" | "sell", asset: AssetInfo, oddAsset?: Asset): boolean {
  if (asset.tokenId === oddAsset?.tokenId) return false;
  if (asset.tokenId !== ERG_INFO.tokenId && loading.value) return false;
  if (!bank.value) return true; // if it's called before bank is loaded

  if (oddAsset && asset.tokenId !== ERG_INFO.tokenId && oddAsset?.tokenId !== ERG_INFO.tokenId) {
    return false; // can't swap between SigUSD and SigSRV
  }

  const rr = bankInfo.value.reserveRatio;
  if (asset.tokenId === SIGUSD_INFO.tokenId) {
    if (action === "sell") return true; // can always sell SigUSD
    return rr >= 400; // can only buy SigUSD if reserve is above 400%
  }
  if (asset.tokenId === SIGSRV_INFO.tokenId) {
    if (action === "sell") return rr >= 400; // can only sell SigSRV if reserve is above 400%
    return rr <= 800; // can only buy SigRSV if reserve is below 800%
  }

  return true; // can always buy/sell ERG
}
</script>
<template>
  <div class="flex h-full flex-col gap-6 p-6">
    <StatsCard title="Bank reserves" :icon="LandmarkIcon" content-class="items-end gap-1">
      <p class="text-xl leading-none font-semibold">{{ bankInfo.reserveRatio }}%</p>
      <p class="text-muted-foreground text-xs leading-tight">
        {{ format.bn.format(bankInfo.baseReserves, 3) }} ERG
      </p>
    </StatsCard>

    <div class="relative flex flex-col gap-2">
      <AssetInputSelect
        v-model:amount="fromAmount"
        v-model:selected-asset="fromAsset"
        :assets="fromAssets"
      />
      <AssetInputSelect
        v-model:amount="toAmount"
        v-model:selected-asset="toAsset"
        :assets="toAssets"
      />

      <Button
        tabindex="-1"
        size="icon"
        variant="outline"
        class="absolute top-1/2 left-1/2 size-8 -translate-x-1/2 -translate-y-1/2"
      >
        <ArrowDownUpIcon />
      </Button>
    </div>

    <div
      v-if="bankInfo && rate"
      class="text-muted-foreground -mt-4 flex items-center justify-between px-2 text-xs"
    >
      <div>
        1 {{ format.asset.name(fromAsset) }} = {{ format.bn.format(rate, 9) }}
        {{ format.asset.name(toAsset) }}
      </div>
      <div>
        Fees: 1.2 ERG
        <ChevronDownIcon class="inline size-4 pb-0.5 pl-1" />
      </div>
    </div>

    <div class="grow"></div>

    <!-- <TransactionFeeConfig v-model="fee" :disabled="loading" :max-multiplier="100" /> -->
    <Button :disabled="loading" class="w-full">Swap</Button>
  </div>
</template>
