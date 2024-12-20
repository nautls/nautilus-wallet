<template>
  <div class="flex flex-col gap-6 py-4 text-sm">
    <div>
      <input
        v-model="filter"
        type="text"
        :disabled="loading"
        placeholder="Search"
        class="control block w-full"
      />
    </div>
    <storage-rent-box />
    <div v-for="asset in assets" :key="asset.tokenId" class="flex h-10 flex-row gap-2">
      <asset-icon class="h-full" :token-id="asset.tokenId" :type="asset.metadata?.type" />
      <div class="flex flex-grow items-center text-sm">
        <a v-if="isErg(asset.tokenId)" class="font-semibold">
          {{ asset.metadata?.name }}
          <p class="text-xs text-gray-500">Ergo</p>
        </a>
        <a v-else class="break-anywhere cursor-pointer" @click="selectedAsset = asset">
          <template v-if="asset.metadata?.name">{{
            format.string.shorten(asset.metadata?.name, 40)
          }}</template>
          <template v-else>{{ format.string.shorten(asset.tokenId, 12) }}</template>
          <p class="text-xs text-gray-500">Ergo</p>
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
            <p class="text-xs text-gray-500">
              ≈
              {{ format.bn.format(asset.confirmedAmount.times(price(asset.tokenId)), 2) }}
              {{ format.string.uppercase(conversionCurrency) }}
            </p>
          </tool-tip>
        </template>
      </div>
    </div>

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
import { ERG_TOKEN_ID } from "@/constants/ergo";
import EmptyLogo from "@/assets/images/tokens/asset-empty.svg";
import AssetInfoModal from "@/components/AssetInfoModal.vue";
import StorageRentBox from "@/components/StorageRentBox.vue";
import { useAppStore } from "@/stores/appStore";
import { useAssetsStore } from "@/stores/assetsStore";
import { StateAssetSummary, useWalletStore } from "@/stores/walletStore";
import { bn } from "@/common/bigNumber";
import { useFormat } from "@/composables/useFormat";

export default defineComponent({
  name: "AssetsView",
  components: {
    EmptyLogo,
    AssetInfoModal,
    StorageRentBox,
    EyeIcon,
    EyeOffIcon
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
