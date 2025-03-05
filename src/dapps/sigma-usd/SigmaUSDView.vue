<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, triggerRef } from "vue";
import { SigmaUSDBank } from "@fleet-sdk/ageusd-plugin";
import { BigNumber } from "bignumber.js";
import { ArrowDownUpIcon, ChevronDownIcon, LandmarkIcon } from "lucide-vue-next";
import { useWalletStore } from "@/stores/walletStore";
import { Button } from "@/components/ui/button";
import { StatsCard } from "@/components/ui/stats-card";
import { bn, decimalize } from "@/common/bigNumber";
import { useFormat } from "@/composables";
import { AssetInfo } from "@/types/internal";
import { getBankBox, getOracleBox } from "./blockchainService";
import { AssetInputSelect } from "./components";
import { ERG_INFO, SIGUSD_INFO } from "./metadata";

const wallet = useWalletStore();
const format = useFormat();

const bank = shallowRef<SigmaUSDBank | null>(null);
const loading = ref(false);

const sigUsd = computed(() => getBalance(SIGUSD_INFO));
const amount = ref<BigNumber | undefined>();

const bankInfo = computed(() => {
  return {
    reserveRatio: bank.value?.reserveRatio ?? 0,
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

function getBalance(asset: AssetInfo) {
  return {
    ...asset,
    balance: wallet.balance.find((b) => b.tokenId === asset.tokenId)?.balance ?? bn(0)
  };
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
    {{ amount }}
    <div class="relative flex flex-col gap-2">
      <AssetInputSelect v-model:amount="amount" :selected-asset="sigUsd" :assets="wallet.balance" />
      <AssetInputSelect v-model:amount="amount" :selected-asset="sigUsd" :assets="wallet.balance" />

      <Button
        tabindex="-1"
        size="icon"
        variant="outline"
        class="absolute top-1/2 left-1/2 size-8 -translate-x-1/2 -translate-y-1/2"
      >
        <ArrowDownUpIcon />
      </Button>
    </div>

    <div class="text-muted-foreground -mt-4 flex items-center justify-between px-2 text-xs">
      <div>1 ERG = 1.5 SigUSD</div>
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
