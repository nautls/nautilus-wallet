<script setup lang="ts">
import { computed, ref } from "vue";
import { BigNumber } from "bignumber.js";
import { EyeIcon, EyeOffIcon, SearchCheckIcon, SearchIcon } from "lucide-vue-next";
import { useAppStore } from "@/stores/appStore";
import { useAssetsStore } from "@/stores/assetsStore";
import { AssetBalance, useWalletStore } from "@/stores/walletStore";
import AssetIcon from "@/components/AssetIcon.vue";
import AssetInfoDialog from "@/components/AssetInfoDialog.vue";
import ImageSandbox from "@/components/ImageSandbox.vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { bn } from "@/common/bigNumber";
import { useFormat } from "@/composables/useFormat";
import { useProgrammaticDialog } from "@/composables/useProgrammaticDialog";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import { currencySymbolMap } from "@/mappers/currencySymbolMap";
import SparklineChart from "./SparklineChart.vue";
import StorageRentAlert from "./StorageRentAlert.vue";

const app = useAppStore();
const assetsStore = useAssetsStore();
const wallet = useWalletStore();
const format = useFormat();

const filter = ref("");
const { open: _openAssetInfoDialog } = useProgrammaticDialog(AssetInfoDialog);

const chart = computed(() => assetsStore.priceChart.map((x) => ({ time: x[0], price: x[1] })));
const ergPrice = computed(() => assetsStore.prices.get(ERG_TOKEN_ID)?.fiat ?? 0);
const containsArtwork = computed(() => wallet.artworkBalance.length > 0);
const tokens = computed(() => filtered(wallet.nonArtworkBalance));
const collectibles = computed(() => filtered(wallet.artworkBalance));
const currencySymbol = computed(() => currencySymbolMap.get(app.settings.conversionCurrency));
const normalizedFilter = computed(() =>
  filter.value !== "" ? filter.value.trim().toLocaleLowerCase() : filter.value
);

const totalWallet = computed(() =>
  wallet.nonArtworkBalance
    .reduce((acc, a) => acc.plus(a.balance.times(rate(a.tokenId))), bn(0))
    .times(ergPrice.value)
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

function isErg(tokenId: string): boolean {
  return tokenId === ERG_TOKEN_ID;
}

function formatCurrencyPrice(value: BigNumber, decimals = 2): string {
  const formattedValue = format.bn.format(value, decimals);
  return currencySymbol.value
    ? `${currencySymbol.value} ${formattedValue}`
    : `${formattedValue} ${format.string.uppercase(app.settings.conversionCurrency)}`;
}

function formatCoinPrice(amount: number, decimals = 9): string {
  return `Σ ${format.bn.format(BigNumber(amount ?? 0), decimals)}`;
}

function openAssetInfoDialog(tokenId: string) {
  if (tokenId === ERG_TOKEN_ID) return;
  _openAssetInfoDialog({ tokenId });
}
</script>

<template>
  <ScrollArea type="scroll">
    <div class="flex-col flex gap-4 px-4">
      <div class="relative bg-header -mx-4">
        <div class="mx-auto w-full bg-transparent pb-2 pt-4 text-center cursor-default">
          <h2 class="text-2xl">
            <span v-if="!app.settings.hideBalances">{{ formatCurrencyPrice(totalWallet) }}</span>
            <Skeleton v-else class="inline-block h-6 w-24 animate-none" />
          </h2>
          <p class="text-sm text-muted-foreground">Wallet balance</p>
        </div>

        <SparklineChart
          class="h-[80px] w-full"
          index="time"
          :data="chart"
          :categories="['price']"
          :show-tooltip="false"
        />
      </div>

      <StorageRentAlert />

      <Tabs default-value="tokens" class="w-full" @update:model-value="() => (filter = '')">
        <div class="flex flex-row">
          <TabsList>
            <TabsTrigger value="tokens">Tokens</TabsTrigger>
            <TabsTrigger value="collectibles" :disabled="!containsArtwork">
              Collectibles
            </TabsTrigger>
          </TabsList>

          <div class="flex-grow"></div>

          <Button
            variant="ghost"
            size="icon"
            @click="app.settings.hideBalances = !app.settings.hideBalances"
          >
            <EyeOffIcon v-if="app.settings.hideBalances" />
            <EyeIcon v-else />
          </Button>
          <Popover>
            <PopoverTrigger>
              <Button variant="ghost" size="icon">
                <SearchIcon v-if="normalizedFilter === ''" />
                <SearchCheckIcon v-else />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="left">
              <Input v-model="filter" placeholder="Search" class="w-full" clearable clear-icon />
            </PopoverContent>
          </Popover>
        </div>

        <TabsContent value="tokens">
          <Transition name="slide-up" appear>
            <div class="flex flex-col gap-2 pt-2">
              <Button
                v-for="asset in tokens"
                :key="asset.tokenId"
                variant="ghost"
                class="h-auto py-3 text-left [&_svg]:size-10"
                @click="openAssetInfoDialog(asset.tokenId)"
              >
                <AssetIcon class="size-10" :token-id="asset.tokenId" :type="asset.metadata?.type" />

                <div
                  class="flex flex-grow flex-col align-middle text-sm gap-1.5"
                  :class="{ 'font-semibold': isErg(asset.tokenId) }"
                >
                  <p class="leading-none">
                    {{ format.asset.name(asset) }}
                  </p>
                  <p class="text-xs text-muted-foreground truncate">
                    {{
                      isErg(asset.tokenId)
                        ? "Ergo"
                        : format.string.shorten(asset.tokenId, 7, "none")
                    }}
                  </p>
                </div>

                <div class="whitespace-nowrap flex flex-col items-end gap-1.5">
                  <template v-if="app.settings.hideBalances">
                    <Skeleton class="h-5 w-24 animate-none" />
                    <Skeleton class="h-3 w-3/4 animate-none" />
                  </template>
                  <template v-else>
                    <span class="leading-none">{{ format.bn.format(asset.balance) }}</span>

                    <TooltipProvider v-if="rate(asset.tokenId)" :delay-duration="100">
                      <Tooltip>
                        <TooltipTrigger class="text-xs text-muted-foreground">
                          {{ formatCurrencyPrice(asset.balance.times(price(asset.tokenId))) }}
                        </TooltipTrigger>
                        <TooltipContent class="text-center">
                          <p class="pb-1 font-bold">1 {{ asset.metadata?.name }}</p>
                          <p>{{ formatCurrencyPrice(price(asset.tokenId)) }}</p>
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
                class="relative rounded-md border bg-card text-card-foreground shadow"
              >
                <image-sandbox
                  :src="nft.metadata?.artworkUrl"
                  class="h-40 w-full overflow-hidden rounded-md"
                  height="10rem"
                  object-fit="cover"
                  overflow="hidden"
                />

                <div class="caption absolute bottom-1 left-1 max-w-32 truncate rounded-md px-2.5">
                  {{ nft.metadata?.name ?? nft.tokenId }}
                </div>
                <div
                  v-if="!nft.balance.eq(1) && !app.settings.hideBalances"
                  class="caption absolute right-1 top-1 flex h-6 min-w-6 rounded-full px-2"
                >
                  <span class="m-auto">{{ format.bn.format(nft.balance) }}</span>
                </div>

                <!-- clickable overlay -->
                <Button
                  class="absolute left-0 top-0 h-40 w-full opacity-30 bg-transparent hover:bg-neutral-900"
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

<style lang="css" scoped>
.caption {
  @apply bg-slate-900/70 py-0.5 font-normal text-neutral-100;
}
</style>
