<script setup lang="ts">
import { computed, nextTick, onMounted, Ref, ref, shallowRef, triggerRef, watch } from "vue";
import { CoinType, FeeType, SigmaUSDBank } from "@fleet-sdk/ageusd-plugin";
import { pausableWatch } from "@vueuse/core";
import { BigNumber } from "bignumber.js";
import {
  ArrowDownUpIcon,
  DollarSignIcon,
  InfoIcon,
  LandmarkIcon,
  SettingsIcon
} from "lucide-vue-next";
import { useAppStore } from "@/stores/appStore";
import { useWalletStore } from "@/stores/walletStore";
import { TransactionFeeConfig } from "@/components/transaction";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { StatsCard } from "@/components/ui/stats-card";
import { bn, dbn, undecimalize } from "@/common/bigNumber";
import { useFormat } from "@/composables";
import { ERG_DECIMALS, ERG_TOKEN_ID, SAFE_MIN_FEE_VALUE } from "@/constants/ergo";
import { AssetInfo, FeeSettings } from "@/types/internal";
import { getBankBox, getOracleBox } from "./blockchainService";
import { Asset, AssetInputSelect } from "./components";
import { ERG_INFO, SIGSRV_INFO, SIGUSD_INFO } from "./metadata";

const _0 = bn(0);
const _1 = bn(1);

const wallet = useWalletStore();
const app = useAppStore();
const format = useFormat();

const bank = shallowRef<SigmaUSDBank | undefined>();
const loading = ref(false);
const lastChanged = ref<"from" | "to">("from");
const isFeeBreakdownOpen = ref<string | undefined>();
const fromAsset = ref<Asset | undefined>(asset("sell", ERG_INFO));
const fromAmount = ref<BigNumber | undefined>();
const toAsset = ref<Asset | undefined>();
const toAmount = ref<BigNumber | undefined>();
const rate = computed(() =>
  toAsset.value && fromAsset.value
    ? toAsset.value.tokenId === ERG_INFO.tokenId
      ? _1.div(getRate(fromAsset.value))
      : getRate(toAsset.value)
    : undefined
);
const fee = ref<FeeSettings>({
  tokenId: ERG_TOKEN_ID,
  value: dbn(SAFE_MIN_FEE_VALUE * 2, ERG_DECIMALS)
});

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
    baseReserves: dbn(bank.value?.baseReserves ?? 0, ERG_INFO.metadata?.decimals),
    stableRate: dbn(bank.value?.stableCoinErgRate ?? _0, SIGUSD_INFO.metadata?.decimals)
  };
});

const nonErg = computed(() =>
  fromAsset.value?.tokenId === ERG_TOKEN_ID
    ? { asset: toAsset.value, amount: toAmount.value }
    : { asset: fromAsset.value, amount: fromAmount.value }
);

const hasInputValues = computed(() => fromAmount.value?.gt(0) && toAmount.value?.gt(0));
const networkFee = computed(() => fee.value.value);
const protocolFee = computed(() => getFeeFor("protocol", nonErg.value.asset, nonErg.value.amount));
const uiFee = computed(() => getFeeFor("implementor", nonErg.value.asset, nonErg.value.amount));
const totalFee = computed(() => networkFee.value.plus(protocolFee.value.plus(uiFee.value)));

// const tcr = computed(() => rate.value); // total conversion rate
// const tcv = computed(() => bankInfo.value.baseReserves); // total conversion value

onMounted(async () => {
  loading.value = true;
  await fetchBoxes();
  loading.value = false;
});

watch(fromAsset, () => convert(lastChanged.value, false));
watch(toAsset, () => convert(lastChanged.value, false));
const fromWatcher = pausableWatch(fromAmount, () => convert("from"));
const toWatcher = pausableWatch(toAmount, () => convert("to"));

function getFeeFor(type: FeeType, asset?: Asset, amount?: BigNumber): BigNumber {
  if (!bank.value || !asset || !amount) return _0;
  return dbn(
    bank.value.getFeeAmountFor(udec(amount, asset.metadata?.decimals), getCoinType(asset), type),
    ERG_DECIMALS
  );
}

function getCoinType(asset: AssetInfo | undefined): CoinType {
  if (asset?.tokenId === SIGUSD_INFO.tokenId) return "stable";
  else return "reserve";
}

function udec(amount: BigNumber | undefined, decimals?: number): bigint {
  if (!amount) return BigInt(0);
  return BigInt(undecimalize(amount, decimals).toString());
}

async function convert(source: "from" | "to", retainSourceInfo = true) {
  if (!bank.value) return;

  const sourceAsset = source === "from" ? fromAsset.value : toAsset.value;
  const targetAsset = source === "from" ? toAsset.value : fromAsset.value;
  const sourceAmount = source === "from" ? fromAmount.value : toAmount.value;
  const targetAmount = source === "from" ? toAmount : fromAmount;
  const targetWatcher = source === "from" ? toWatcher : fromWatcher;

  if (!sourceAsset || !targetAsset) return;
  if (sourceAsset.tokenId === targetAsset.tokenId) return;

  try {
    targetWatcher.pause();

    await nextTick(() => {
      if (!sourceAmount || sourceAmount.isZero()) {
        targetAmount.value = _0;
        return;
      }

      if (sourceAsset.tokenId === ERG_INFO.tokenId) {
        targetAmount.value = sourceAmount
          .times(getRate(targetAsset))
          .decimalPlaces(targetAsset.metadata?.decimals ?? 0);
      } else {
        targetAmount.value = sourceAmount
          .div(getRate(sourceAsset))
          .decimalPlaces(targetAsset.metadata?.decimals ?? 0);
      }
    });
  } finally {
    if (retainSourceInfo) lastChanged.value = source;
    targetWatcher.resume();
  }
}

function getRate(asset: Asset): BigNumber {
  if (!bank.value) return _0;
  if (asset.tokenId === ERG_INFO.tokenId) return _1;
  if (asset.tokenId === SIGUSD_INFO.tokenId)
    return dbn(bank.value.stableCoinErgRate, SIGUSD_INFO.metadata?.decimals);
  if (asset.tokenId === SIGSRV_INFO.tokenId) return bn(bank.value.reserveCoinErgRate);
  return _0;
}

async function fetchBoxes() {
  const [bankBox, oracleBox] = await Promise.all([getBankBox(), getOracleBox()]);

  if (!bank.value) {
    if (!bankBox || !oracleBox) return;

    bank.value = new SigmaUSDBank(bankBox, oracleBox).setImplementorFee({
      percentage: 22n,
      precision: 4n,
      address: "9iPgSVU3yrRnTxtJC6hYA7bS5mMqZtjeJHrT3fNdLV7JZVpY5By"
    });
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
  const balance = wallet.balance.find((b) => b.tokenId === asset.tokenId)?.balance ?? _0;
  return {
    ...asset,
    balance,
    disabled: !can(action, asset, balance, oddSelection?.value)
  };
}

function can(
  action: "buy" | "sell",
  asset: AssetInfo,
  balance?: BigNumber,
  oddAsset?: Asset
): boolean {
  if (asset.tokenId === oddAsset?.tokenId) return false;
  if (asset.tokenId !== ERG_INFO.tokenId && loading.value) return false;
  if (!bank.value) return true; // if it's called before bank is loaded

  if (oddAsset && asset.tokenId !== ERG_INFO.tokenId && oddAsset?.tokenId !== ERG_INFO.tokenId) {
    return false; // can't swap between SigUSD and SigSRV
  }

  balance = balance ?? _0;
  const rr = bankInfo.value.reserveRatio;
  if (asset.tokenId === SIGUSD_INFO.tokenId) {
    if (action === "sell") return balance.gt(0); // can always sell SigUSD if balance is above 0
    return rr >= 400; // can only buy SigUSD if reserve is above 400%
  }
  if (asset.tokenId === SIGSRV_INFO.tokenId) {
    if (action === "sell") return rr >= 400 && balance.gt(0); // can only sell SigSRV if reserve is above 400% and balance is above 0
    return rr <= 800; // can only buy SigRSV if reserve is below 800%
  }

  return true; // can always buy/sell ERG
}
</script>
<template>
  <div class="flex h-full flex-col gap-6 p-6">
    <div class="flex gap-4">
      <StatsCard
        class="w-full"
        title="Bank reserves"
        :icon="LandmarkIcon"
        content-class="items-end gap-1 justify-between"
      >
        <p class="text-xl leading-none font-semibold">{{ bankInfo.reserveRatio }}%</p>
        <p class="text-muted-foreground text-xs leading-tight">
          Σ {{ format.bn.format(bankInfo.baseReserves, 3) }}
        </p>
      </StatsCard>
      <StatsCard
        class="w-full min-w-max"
        title="Current rate"
        :icon="DollarSignIcon"
        content-class="items-end gap-1 justify-between"
      >
        <p class="text-xl leading-none font-semibold">
          {{ format.currency.amount(bankInfo.stableRate, app.settings.conversionCurrency) }}
        </p>
        <p class="text-muted-foreground text-xs leading-tight">1 ERG</p>
      </StatsCard>
    </div>

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

    <Accordion
      v-if="bankInfo && rate"
      v-model="isFeeBreakdownOpen"
      type="single"
      collapsible
      class="-mt-4"
    >
      <AccordionItem value="opened" class="border-none">
        <AccordionTrigger class="text-muted-foreground p-0 pr-2 text-xs hover:no-underline">
          <div class="text-muted-foreground flex w-full items-center justify-between px-2">
            <div>
              1 {{ format.asset.name(fromAsset) }} =
              {{ format.bn.format(rate, toAsset?.metadata?.decimals) }}
              {{ format.asset.name(toAsset) }}
            </div>
            <div v-if="!isFeeBreakdownOpen">
              <span class="font-semibold">Fee</span> {{ format.bn.format(totalFee, 4) }} ERG
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent class="space-y-1 px-2 pt-2 pb-0 text-xs">
          <div class="flex items-center justify-between">
            <div class="font-medium">
              Protocol Fee <span class="text-muted-foreground">(2%) </span>
              <InfoIcon class="inline size-3" />
            </div>
            <div>{{ format.bn.format(protocolFee) }} ERG</div>
          </div>
          <div class="flex items-center justify-between">
            <div class="font-medium">
              Service Fee <span class="text-muted-foreground">(0.22%) </span>
              <InfoIcon class="inline size-3" />
            </div>
            <div>{{ format.bn.format(uiFee) }} ERG</div>
          </div>
          <div class="flex items-center justify-between">
            <div class="font-medium">
              Network Fee <InfoIcon class="inline size-3" />
              <Popover>
                <PopoverTrigger as-child>
                  <Button
                    variant="minimal"
                    :disabled="loading"
                    class="ml-1 size-3 align-middle"
                    size="condensed"
                  >
                    <SettingsIcon />
                  </Button>
                </PopoverTrigger>
                <PopoverContent class="p-0">
                  <TransactionFeeConfig
                    v-model="fee"
                    erg-only
                    :max-multiplier="1000"
                    class="border-0 shadow-none"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>{{ format.bn.format(networkFee) }} ERG</div>
          </div>
          <div class="flex items-center justify-between font-semibold">
            <div>Total Fee</div>
            <div>{{ format.bn.format(totalFee) }} ERG</div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>

    <div class="-my-4 grow"></div>

    <Button :disabled="loading || !hasInputValues" class="w-full">Swap</Button>
  </div>
</template>
