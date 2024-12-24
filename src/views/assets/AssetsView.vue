<script setup lang="ts">
import { computed, ref } from "vue";
import { BigNumber } from "bignumber.js";
import { EyeIcon, EyeOffIcon, SearchCheckIcon, SearchIcon } from "lucide-vue-next";
import SparklineChart from "./SparklineChart.vue";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import StorageRentBox from "@/components/StorageRentBox.vue";
import { useAppStore } from "@/stores/appStore";
import { useAssetsStore } from "@/stores/assetsStore";
import { StateAssetSummary, useWalletStore } from "@/stores/walletStore";
import { bn } from "@/common/bigNumber";
import { useFormat } from "@/composables/useFormat";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import ImageSandbox from "@/components/ImageSandbox.vue";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import AssetIcon from "@/components/AssetIcon.vue";

const app = useAppStore();
const assetsStore = useAssetsStore();
const wallet = useWalletStore();
const format = useFormat();

const filter = ref("");

const chart = computed(() => assetsStore.priceChart.map((x) => ({ time: x[0], price: x[1] })));
const ergPrice = computed(() => assetsStore.prices.get(ERG_TOKEN_ID)?.fiat ?? 0);
const containsArtwork = computed(() => wallet.artworkBalance.length > 0);
const tokens = computed(() => filtered(wallet.nonArtworkBalance));
const collectibles = computed(() => filtered(wallet.artworkBalance));

const normalizedFilter = computed(() =>
  filter.value !== "" ? filter.value.trim().toLocaleLowerCase() : filter.value
);

const totalWallet = computed(() =>
  wallet.nonArtworkBalance
    .reduce((acc, a) => acc.plus(a.confirmedAmount.times(rate(a.tokenId))), bn(0))
    .times(ergPrice.value)
);

function filtered(assets: StateAssetSummary[]): StateAssetSummary[] {
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

function formatCurrencyPrice(amount: BigNumber, decimals = 2): string {
  return `≈ ${format.bn.format(amount, decimals)} ${format.string.uppercase(app.settings.conversionCurrency)}`;
}

function formatCoinPrice(amount: number, decimals = 9): string {
  return `≈ ${format.bn.format(BigNumber(amount ?? 0), decimals)} ERG`;
}

function formatAssetName(asset: StateAssetSummary): string {
  return asset.metadata?.name
    ? format.string.shorten(asset.metadata?.name, 20)
    : format.string.shorten(asset.tokenId, 12);
}
</script>

<template>
  <div class="relative mb-4 bg-foreground/5">
    <div class="mx-auto w-full bg-transparent pb-2 pt-4 text-center">
      <p class="text-2xl">
        <span v-if="!app.settings.hideBalances">$ {{ format.bn.format(totalWallet, 2) }}</span>
        <Skeleton v-else class="inline-block h-6 w-24 animate-none" />
      </p>
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
  <div class="px-4">
    <storage-rent-box />

    <Tabs default-value="tokens" class="w-full">
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
        <div class="flex flex-col gap-0 pb-4 pt-2">
          <Button
            v-for="asset in tokens"
            :key="asset.tokenId"
            variant="ghost"
            class="h-auto py-3 text-left"
          >
            <AssetIcon
              class="!h-auto !w-10"
              :token-id="asset.tokenId"
              :type="asset.metadata?.type"
            />

            <div
              class="flex flex-grow flex-col align-middle text-sm"
              :class="{ 'font-semibold': isErg(asset.tokenId) }"
            >
              <div>
                {{ formatAssetName(asset) }}
              </div>
              <div class="text-xs text-muted-foreground">
                {{
                  isErg(asset.tokenId) ? "Ergo" : format.string.shorten(asset.tokenId, 7, "none")
                }}
              </div>
            </div>

            <div class="whitespace-nowrap text-right align-middle">
              <div v-if="app.settings.hideBalances" class="flex flex-col items-end gap-1">
                <Skeleton class="h-5 w-24 animate-none" />
                <Skeleton class="h-3 w-3/4 animate-none" />
              </div>
              <template v-else>
                <div>
                  {{ format.bn.format(asset.confirmedAmount) }}
                </div>

                <TooltipProvider v-if="rate(asset.tokenId)" :delay-duration="100">
                  <Tooltip>
                    <TooltipTrigger class="text-xs text-muted-foreground">
                      {{ formatCurrencyPrice(asset.confirmedAmount.times(price(asset.tokenId))) }}
                    </TooltipTrigger>
                    <TooltipContent class="bg-foreground">
                      <div>
                        <p class="pb-1 font-bold">1 {{ asset.metadata?.name }}</p>
                        <p>{{ formatCurrencyPrice(price(asset.tokenId)) }}</p>
                        <p v-if="!isErg(asset.tokenId)">
                          {{ formatCoinPrice(rate(asset.tokenId)) }}
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </template>
            </div>
          </Button>
        </div>
      </TabsContent>

      <TabsContent value="collectibles">
        <div class="grid grid-cols-2 justify-stretch gap-4 p-4 sm:grid-cols-4 md:grid-cols-2">
          <div
            v-for="nft in collectibles"
            :key="nft.tokenId"
            class="relative cursor-pointer rounded-md border bg-card text-card-foreground shadow"
          >
            <image-sandbox
              :src="nft.metadata?.artworkUrl"
              class="h-40 w-full overflow-hidden rounded-md"
              height="10rem"
              object-fit="cover"
              overflow="hidden"
            />

            <!-- clickable overlay -->
            <div class="absolute left-0 top-0 h-40 w-full bg-transparent"></div>

            <p class="caption absolute bottom-1 left-1 w-10/12 truncate rounded-md px-2.5">
              {{ nft.metadata?.name ?? nft.tokenId }}
            </p>
            <div
              v-if="!nft.confirmedAmount.eq(1) && !app.settings.hideBalances"
              class="caption absolute right-1 top-1 flex h-6 min-w-6 rounded-full px-2"
            >
              <span class="m-auto">{{ format.bn.format(nft.confirmedAmount) }}</span>
            </div>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  </div>

  <!-- <asset-info-modal
      :token-id="selectedAsset?.tokenId"
      :confirmed-balance="selectedAsset?.confirmedAmount"
      @close="selectedAsset = undefined"
    /> -->
</template>

<style lang="css" scoped>
.caption {
  @apply bg-neutral-900/70 py-0.5 font-normal text-neutral-100;
}
</style>
