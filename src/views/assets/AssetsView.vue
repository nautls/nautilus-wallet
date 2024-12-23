<script setup lang="ts">
import { computed, ref } from "vue";
import { BigNumber } from "bignumber.js";
import { EyeIcon, EyeOffIcon, SearchIcon } from "lucide-vue-next";
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

const app = useAppStore();
const assetsStore = useAssetsStore();
const wallet = useWalletStore();
const format = useFormat();

const filter = ref("");

const chart = computed(() => assetsStore.priceChart.map((x) => ({ time: x[0], price: x[1] })));
const ergPrice = computed(() => assetsStore.prices.get(ERG_TOKEN_ID)?.fiat ?? 0);
const conversionCurrency = computed(() => app.settings.conversionCurrency);
const containsArtwork = computed(() => wallet.artworkBalance.length > 0);
// const loading = computed(() => wallet.loading && wallet.nonArtworkBalance.length === 0);
const tokens = computed(() => filtered(wallet.nonArtworkBalance));
const collectibles = computed(() => filtered(wallet.artworkBalance));

const totalWallet = computed(() =>
  wallet.nonArtworkBalance
    .reduce((acc, a) => acc.plus(a.confirmedAmount.times(rate(a.tokenId))), bn(0))
    .times(ergPrice.value)
);

function filtered(assets: StateAssetSummary[]): StateAssetSummary[] {
  const lcFilter = filter.value.trim().toLocaleLowerCase();
  if (filter.value === "" || assets.length === 0) return assets;

  return assets.filter((a) => a.metadata?.name?.toLocaleLowerCase().includes(lcFilter));
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
</script>

<template>
  <div class="relative mb-4 bg-foreground/5">
    <div class="mx-auto w-full bg-transparent pb-2 pt-4 text-center">
      <p class="text-2xl">$ {{ format.bn.format(totalWallet, 2) }}</p>
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
          <TabsTrigger value="tokens"> Tokens</TabsTrigger>
          <TabsTrigger value="collectibles" :disabled="!containsArtwork">
            Collectibles
          </TabsTrigger>
        </TabsList>

        <div class="flex-grow"></div>

        <Button
          variant="ghost"
          size="icon"
          @click="app.settings.hideBalances = !app.settings.hideBalances"
          ><EyeOffIcon v-if="app.settings.hideBalances" /><EyeIcon v-else
        /></Button>
        <Button variant="ghost" size="icon"><SearchIcon /></Button>
      </div>

      <TabsContent value="tokens" class="">
        <div class="flex flex-col gap-6 p-4">
          <div v-for="asset in tokens" :key="asset.tokenId" class="flex h-10 flex-row gap-2">
            <asset-icon class="h-full" :token-id="asset.tokenId" :type="asset.metadata?.type" />
            <div class="flex flex-grow items-center text-sm">
              <a v-if="isErg(asset.tokenId)" class="font-semibold">
                {{ asset.metadata?.name }}
                <p class="text-xs text-muted-foreground">Ergo</p>
              </a>
              <a v-else class="break-anywhere cursor-pointer">
                <template v-if="asset.metadata?.name">{{
                  format.string.shorten(asset.metadata?.name, 40)
                }}</template>
                <template v-else>{{ format.string.shorten(asset.tokenId, 12) }}</template>
                <p class="text-xs text-muted-foreground">Ergo</p>
              </a>
            </div>
            <div class="whitespace-nowrap text-right align-middle">
              <div v-if="app.settings.hideBalances" class="flex flex-col items-end gap-1">
                <div class="skeleton h-5 w-full animate-none rounded"></div>
                <div class="skeleton h-3 w-3/4 animate-none rounded"></div>
              </div>
              <template v-else>
                <p>
                  {{ format.bn.format(asset.confirmedAmount) }}
                </p>
                <tool-tip
                  v-if="!asset.confirmedAmount.isZero() && ergPrice && rate(asset.tokenId)"
                  :label="`1 ${asset.metadata?.name} <br /> ≈ ${format.bn.format(
                    price(asset.tokenId),
                    2
                  )} ${format.string.uppercase(conversionCurrency)}`"
                >
                  <p class="text-xs text-muted-foreground">
                    ≈
                    {{ format.bn.format(asset.confirmedAmount.times(price(asset.tokenId)), 2) }}
                    {{ format.string.uppercase(conversionCurrency) }}
                  </p>
                </tool-tip>
              </template>
            </div>
          </div>
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

            <p class="caption absolute bottom-1 left-1 w-10/12 truncate rounded-md">
              {{ nft.metadata?.name ?? nft.tokenId }}
            </p>
            <div
              v-if="!nft.confirmedAmount.eq(1)"
              class="caption absolute right-1 top-1 h-6 min-w-6 rounded-full !px-1 px-2.5 text-center"
            >
              {{ format.bn.format(nft.confirmedAmount) }}
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
  @apply bg-foreground/70 py-0.5 font-normal text-background;
}
</style>
