<template>
  <div class="relative mb-4 bg-foreground/5 pt-4">
    <div class="mx-auto w-full bg-transparent text-center">
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
      <TabsList class="m-auto">
        <TabsTrigger value="tokens"> Tokens</TabsTrigger>
        <TabsTrigger value="collectibles"> Collectibles </TabsTrigger>
      </TabsList>
      <!-- <Input
        v-model="filter"
        class="text-xs"
        type="text"
        :disabled="loading"
        placeholder="Search"
      /> -->

      <TabsContent value="tokens" class="flex flex-col gap-6 p-4">
        <div v-for="asset in assets" :key="asset.tokenId" class="flex h-10 flex-row gap-2">
          <asset-icon class="h-full" :token-id="asset.tokenId" :type="asset.metadata?.type" />
          <div class="flex flex-grow items-center text-sm">
            <a v-if="isErg(asset.tokenId)" class="font-semibold">
              {{ asset.metadata?.name }}
              <p class="text-xs text-muted-foreground">Ergo</p>
            </a>
            <a v-else class="break-anywhere cursor-pointer" @click="selectedAsset = asset">
              <template v-if="asset.metadata?.name">{{
                format.string.shorten(asset.metadata?.name, 40)
              }}</template>
              <template v-else>{{ format.string.shorten(asset.tokenId, 12) }}</template>
              <p class="text-xs text-muted-foreground">Ergo</p>
            </a>
          </div>
          <div class="whitespace-nowrap text-right align-middle">
            <div v-if="hideBalances" class="flex flex-col items-end gap-1">
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
      </TabsContent>
      <TabsContent value="collectibles"> Collectibles </TabsContent>
    </Tabs>
  </div>
  <div class="flex flex-col gap-6 p-2 text-sm">
    <asset-info-modal
      :token-id="selectedAsset?.tokenId"
      :confirmed-balance="selectedAsset?.confirmedAmount"
      @close="selectedAsset = undefined"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { BigNumber } from "bignumber.js";
import { EyeIcon, EyeOffIcon } from "lucide-vue-next";
import SparklineChart from "./SparklineChart.vue";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import EmptyLogo from "@/assets/images/tokens/asset-empty.svg";
import AssetInfoModal from "@/components/AssetInfoModal.vue";
import StorageRentBox from "@/components/StorageRentBox.vue";
import { useAppStore } from "@/stores/appStore";
import { useAssetsStore } from "@/stores/assetsStore";
import { StateAssetSummary, useWalletStore } from "@/stores/walletStore";
import { bn } from "@/common/bigNumber";
import { useFormat } from "@/composables/useFormat";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";

export default defineComponent({
  name: "AssetsView",
  components: {
    EmptyLogo,
    AssetInfoModal,
    StorageRentBox,
    EyeIcon,
    EyeOffIcon,
    SparklineChart,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    Input
  },
  setup() {
    return {
      app: useAppStore(),
      assetsStore: useAssetsStore(),
      wallet: useWalletStore(),
      format: useFormat()
    };
  },
  data() {
    return {
      filter: "",
      prevCount: 1,
      selectedAsset: undefined as StateAssetSummary | undefined
    };
  },
  computed: {
    chart(): { time: number; price: number }[] {
      return this.assetsStore.priceChart.map((x) => ({ time: x[0], price: x[1] }));
    },
    ergPrice(): number {
      return this.assetsStore.prices.get(ERG_TOKEN_ID)?.fiat ?? 0;
    },
    conversionCurrency(): string {
      return this.app.settings.conversionCurrency;
    },
    loading(): boolean {
      return this.wallet.loading && this.wallet.nonArtworkBalance.length === 0;
    },
    assets() {
      const assetList = this.wallet.nonArtworkBalance;

      if (this.filter !== "" && assetList.length > 0) {
        return assetList.filter((a) =>
          a.metadata?.name?.toLocaleLowerCase().includes(this.filter.toLocaleLowerCase())
        );
      }

      return assetList;
    },
    hideBalances(): boolean {
      return this.app.settings.hideBalances;
    },
    totalWallet(): BigNumber {
      return this.wallet.nonArtworkBalance
        .reduce((acc, a) => acc.plus(a.confirmedAmount.times(this.rate(a.tokenId))), bn(0))
        .times(this.ergPrice);
    }
  },
  watch: {
    ["assets.length"](_, oldLen) {
      const length = oldLen || 1;
      if (length > 1) this.prevCount = length;
    }
  },
  methods: {
    price(tokenId: string): BigNumber {
      const rate = this.rate(tokenId);
      if (!rate || !this.ergPrice) return bn(0);
      return bn(rate).times(this.ergPrice);
    },
    rate(tokenId: string): number {
      return this.assetsStore.prices.get(tokenId)?.erg ?? 0;
    },
    isErg(tokenId: string): boolean {
      return tokenId === ERG_TOKEN_ID;
    },
    toggleHideBalance(): void {
      this.app.settings.hideBalances = !this.app.settings.hideBalances;
    }
  }
});
</script>
