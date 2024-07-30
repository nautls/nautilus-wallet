<template>
  <div class="flex flex-col gap-4">
    <div>
      <input
        v-model="filter"
        type="text"
        :disabled="loading"
        placeholder="Search"
        class="w-full control block"
      />
    </div>
    <storage-rent-box />
    <div class="border rounded">
      <table class="table">
        <thead>
          <tr>
            <th colspan="2">Asset</th>
            <th>
              <div class="flex-row justify-end flex gap-2 align-middle">
                <tool-tip
                  :label="hideBalances ? 'Show' : 'Hide'"
                  tip-class="normal-case"
                  class="align-middle"
                >
                  <a class="cursor-pointer inline-flex" @click="toggleHideBalance()">
                    <mdi-icon :name="hideBalances ? 'eye-off' : 'eye'" size="16" />
                  </a>
                </tool-tip>
                Balance
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <template v-if="loading">
            <tr v-for="i in prevCount" :key="i" class="h-19">
              <td class="w-14 min-w-14 align-middle">
                <empty-logo class="h-8 w-8 animate-pulse fill-gray-300" />
              </td>
              <td class="align-middle">
                <div class="skeleton h-3 w-2/3 rounded"></div>
              </td>
              <td class="text-right w-50 align-middle">
                <div class="skeleton h-3 w-3/5 rounded float-right"></div>
                <br />
                <div class="skeleton h-3 w-2/5 rounded float-right"></div>
              </td>
            </tr>
          </template>
          <tr v-for="asset in assets" v-else :key="asset.tokenId" class="h-19">
            <td class="w-14 min-w-14 align-middle">
              <asset-icon
                class="h-8 w-8 align-middle"
                :token-id="asset.tokenId"
                :type="asset.metadata?.type"
              />
            </td>
            <td class="align-middle">
              <p v-if="isErg(asset.tokenId)" class="font-semibold">
                {{ asset.metadata?.name }}
              </p>
              <a v-else class="break-anywhere cursor-pointer" @click="selectedAsset = asset">
                <template v-if="asset.metadata?.name">{{
                  format.string.shorten(asset.metadata?.name, 40)
                }}</template>
                <template v-else>{{ format.string.shorten(asset.tokenId, 12) }}</template>
              </a>
            </td>
            <td class="text-right align-middle whitespace-nowrap">
              <div v-if="hideBalances" class="flex flex-col gap-1 items-end">
                <div class="skeleton animate-none h-4.5 w-full rounded"></div>
                <div class="skeleton animate-none h-3 w-3/4 rounded"></div>
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
            </td>
          </tr>
        </tbody>
      </table>
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
    StorageRentBox
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
