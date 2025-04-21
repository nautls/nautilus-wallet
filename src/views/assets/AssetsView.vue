<script setup lang="ts">
import { computed, ref, watch } from "vue";
import BigNumber from "bignumber.js";
import { SearchCheckIcon, SearchIcon } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import { useAppStore } from "@/stores/appStore";
import { useAssetsStore } from "@/stores/assetsStore";
import { AssetBalance, useWalletStore } from "@/stores/walletStore";
import { AssetIcon, AssetImageSandbox, AssetInfoDialog } from "@/components/asset";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { bn } from "@/common/bigNumber";
import { isErg } from "@/common/utils";
import { useFormat } from "@/composables/useFormat";
import { useProgrammaticDialog } from "@/composables/useProgrammaticDialog";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import WalletAlerts from "./components/WalletAlerts.vue";

const app = useAppStore();
const assetsStore = useAssetsStore();
const wallet = useWalletStore();
const format = useFormat();

const { t } = useI18n({ useScope: "global" });

const filter = ref("");
const currentTab = ref<"tokens" | "collectibles">("tokens");
const { open: _openAssetInfoDialog } = useProgrammaticDialog(AssetInfoDialog);

const ergPrice = computed(() => assetsStore.prices.get(ERG_TOKEN_ID)?.fiat ?? 0);
const containsArtwork = computed(() => wallet.artworkBalance.length > 0);
const tokens = computed(() => filtered(wallet.nonArtworkBalance));
const collectibles = computed(() => filtered(wallet.artworkBalance));
const normalizedFilter = computed(() =>
  filter.value !== "" ? filter.value.trim().toLocaleLowerCase() : filter.value
);

const walletTotal = computed(() =>
  wallet.nonArtworkBalance
    .reduce((acc, a) => acc.plus(a.balance.times(rate(a.tokenId))), bn(0))
    .times(ergPrice.value)
);

watch(
  () => wallet.id,
  () => {
    filter.value = "";
    currentTab.value = "tokens";
  }
);

function filtered(assets: AssetBalance[]): AssetBalance[] {
  if (normalizedFilter.value === "" || assets.length === 0) return assets;

  return assets.filter((a) =>
    a.metadata?.name?.toLocaleLowerCase().includes(normalizedFilter.value)
  );
}

function price(tokenId: string): BigNumber {
  const r = rate(tokenId);
  return r ? bn(r).times(ergPrice.value) : bn(0);
}

function rate(tokenId: string): number {
  return assetsStore.prices.get(tokenId)?.erg ?? 0;
}

function formatCurrencyAmount(value: BigNumber, decimals = 2): string {
  return format.currency.amount(value, app.settings.conversionCurrency, decimals);
}

function formatCoinPrice(amount: number, decimals = 9): string {
  return `Σ ${format.number.decimal(BigNumber(amount ?? 0), decimals)}`;
}

function openAssetInfoDialog(tokenId: string) {
  if (tokenId === ERG_TOKEN_ID) return;
  _openAssetInfoDialog({ tokenId });
}
</script>

<template>
  <ScrollArea type="scroll">
    <div class="flex flex-col gap-4 p-6">
      <div class="mx-auto w-full cursor-default bg-transparent py-2 pb-4 text-center">
        <h2 class="text-3xl">
          <span v-if="!app.settings.hideBalances">{{ formatCurrencyAmount(walletTotal) }}</span>
          <Skeleton v-else class="inline-block h-7 w-24 animate-none" />
        </h2>
        <p class="text-muted-foreground text-sm">{{ t("asset.totalBalance") }}</p>
      </div>

      <WalletAlerts />

      <Tabs v-model="currentTab" class="w-full" @update:model-value="() => (filter = '')">
        <div class="flex flex-row">
          <TabsList>
            <TabsTrigger value="tokens">{{ t("asset.tabs.tokens") }}</TabsTrigger>
            <TabsTrigger value="collectibles" :disabled="!containsArtwork">
              {{ t("asset.tabs.collectibles") }}
            </TabsTrigger>
          </TabsList>

          <div class="grow"></div>

          <Popover>
            <PopoverTrigger>
              <Button variant="ghost" size="icon">
                <SearchIcon v-if="normalizedFilter === ''" />
                <SearchCheckIcon v-else />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="left">
              <Input
                v-model="filter"
                :placeholder="t('common.search')"
                class="w-full"
                clearable
                clear-icon
              />
            </PopoverContent>
          </Popover>
        </div>

        <TabsContent value="tokens">
          <Transition name="slide-up" appear>
            <div class="flex flex-col pt-1">
              <Button
                v-for="asset in tokens"
                :key="asset.tokenId"
                variant="ghost"
                @click="openAssetInfoDialog(asset.tokenId)"
                class="h-auto px-2 py-3 text-left [&_svg]:size-10"
              >
                <AssetIcon class="size-10" :token-id="asset.tokenId" :type="asset.metadata?.type" />

                <div
                  class="flex grow flex-col gap-0.5 align-middle text-sm"
                  :class="{ 'font-semibold': isErg(asset.tokenId) }"
                >
                  <p>{{ format.asset.name(asset) }}</p>

                  <p class="text-muted-foreground truncate text-xs">
                    {{ format.asset.id(asset.tokenId) }}
                  </p>
                </div>

                <div class="flex flex-col items-end gap-0.5 whitespace-nowrap">
                  <template v-if="app.settings.hideBalances">
                    <Skeleton class="h-5 w-24 animate-none" />
                    <Skeleton class="h-3 w-3/4 animate-none" />
                  </template>
                  <template v-else>
                    <span>{{ format.number.decimal(asset.balance) }}</span>

                    <TooltipProvider :delay-duration="100" v-if="rate(asset.tokenId)">
                      <Tooltip>
                        <TooltipTrigger class="text-muted-foreground text-xs">
                          {{ formatCurrencyAmount(asset.balance.times(price(asset.tokenId))) }}
                        </TooltipTrigger>
                        <TooltipContent class="text-center">
                          <p class="pb-1 font-bold">
                            {{
                              t("common.amount.named", { amount: 1, name: asset.metadata?.name })
                            }}
                          </p>
                          <p>{{ formatCurrencyAmount(price(asset.tokenId)) }}</p>
                          <p v-if="!isErg(asset.tokenId)">
                            {{ formatCoinPrice(rate(asset.tokenId)) }}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </template>
                </div>
              </Button>
            </div>
          </Transition>
        </TabsContent>

        <TabsContent value="collectibles">
          <Transition name="slide-up" appear>
            <div
              class="grid grid-cols-2 justify-stretch gap-4 px-2 py-4 sm:grid-cols-4 md:grid-cols-2"
            >
              <div
                v-for="nft in collectibles"
                :key="nft.tokenId"
                class="bg-card text-card-foreground relative rounded-md border shadow-sm"
              >
                <AssetImageSandbox
                  :src="nft.metadata?.artworkUrl"
                  class="h-40 w-full overflow-hidden rounded-md"
                  height="10rem"
                  object-fit="cover"
                  overflow="hidden"
                />

                <div
                  class="absolute bottom-1 left-1 max-w-32 truncate rounded-md bg-slate-900/70 px-2.5 py-0.5 font-normal text-neutral-100"
                >
                  {{ nft.metadata?.name ?? nft.tokenId }}
                </div>
                <div
                  v-if="!nft.balance.eq(1) && !app.settings.hideBalances"
                  class="absolute top-1 right-1 flex h-6 min-w-6 rounded-full bg-slate-900/70 px-2 py-0.5 font-normal text-neutral-100"
                >
                  <span class="m-auto">{{ format.number.decimal(nft.balance) }}</span>
                </div>

                <!-- clickable overlay -->
                <Button
                  class="absolute top-0 left-0 h-40 w-full bg-transparent opacity-30 hover:bg-neutral-900"
                  variant="ghost"
                  @click="openAssetInfoDialog(nft.tokenId)"
                ></Button>
              </div>
            </div>
          </Transition>
        </TabsContent>
      </Tabs>
    </div>
  </ScrollArea>
</template>
