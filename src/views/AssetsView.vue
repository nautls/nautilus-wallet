<template>
  <div class="flex flex-col gap-5">
    <div>
      <input
        type="text"
        :disabled="loading"
        v-model="filter"
        placeholder="Search"
        class="w-full control block"
      />
    </div>
    <div class="border rounded">
      <table class="table">
        <thead>
          <tr>
            <th colspan="2">Asset</th>
            <th class="text-right">Balance</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading" v-for="i in prevCount" :key="i">
            <td class="w-14 align-middle">
              <img src="@/assets/images/defaultAssetLogo.svg" class="h-8 w-8 animate-pulse" />
            </td>
            <td class="align-middle">
              <div class="skeleton h-3 w-2/3 rounded"></div>
            </td>
            <td class="text-right w-50 align-middle">
              <div class="skeleton h-3 w-3/5 rounded"></div>
              <template v-if="i === 1">
                <br />
                <div class="skeleton h-3 w-2/5 rounded"></div>
              </template>
            </td>
          </tr>
          <tr v-else v-for="asset in assets" :key="asset.tokenId">
            <td class="w-14 align-middle">
              <img
                :src="$filters.assetLogo(asset.tokenId)"
                class="h-8 w-8 rounded-full"
                :alt="asset.name"
              />
            </td>
            <td class="align-middle">
              <p v-if="isErg(asset.tokenId)" class="font-semibold">
                {{ asset.name }}
              </p>
              <a v-else :href="urlFor(asset.tokenId)" target="_blank" class="break-all">
                <template v-if="asset.name">{{
                  $filters.compactString(asset.name, 30, "end")
                }}</template>
                <template v-else>{{ $filters.compactString(asset.tokenId, 12) }}</template>
              </a>
            </td>
            <td class="text-right align-middle whitespace-nowrap">
              <p>
                {{ $filters.formatBigNumber(asset.confirmedAmount) }}
              </p>
              <tool-tip
                v-if="!asset.confirmedAmount.isZero() && ergPrice && rate(asset.tokenId)"
                :label="`1 ${asset.name} <br /> ≈ ${$filters.formatBigNumber(
                  price(asset.tokenId),
                  2
                )} ${$filters.uppercase(conversionCurrency)}`"
              >
                <p class="text-xs text-gray-500">
                  ≈
                  {{
                    $filters.formatBigNumber(
                      asset.confirmedAmount.multipliedBy(price(asset.tokenId)),
                      2
                    )
                  }}
                  {{ $filters.uppercase(conversionCurrency) }}
                </p>
              </tool-tip>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { GETTERS } from "@/constants/store/getters";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import { StateAsset } from "@/types/internal";
import { TOKEN_INFO_URL } from "@/constants/explorer";
import BigNumber from "bignumber.js";

export default defineComponent({
  name: "AssetsView",
  computed: {
    ergPrice(): number {
      return this.$store.state.ergPrice;
    },
    conversionCurrency(): string {
      return this.$store.state.settings.conversionCurrency;
    },
    loading(): boolean {
      if (!this.$store.state.loading.balance) {
        return false;
      }

      const assetList: StateAsset[] = this.$store.getters[GETTERS.BALANCE];
      if (assetList.length === 0) {
        return true;
      }

      return false;
    },
    assets(): StateAsset[] {
      const assetList = this.$store.getters[GETTERS.BALANCE];

      if (this.filter !== "" && assetList.length > 0) {
        return assetList.filter((a: StateAsset) =>
          a.name?.toLocaleLowerCase().includes(this.filter.toLocaleLowerCase())
        );
      }

      return assetList;
    }
  },
  watch: {
    ["assets.length"](newLen, oldLen) {
      const length = oldLen || 1;
      if (length > 1) {
        this.prevCount = length;
      }
    }
  },
  data() {
    return {
      filter: "",
      prevCount: 1
    };
  },
  methods: {
    price(tokenId: string): BigNumber {
      const rate = this.rate(tokenId);
      if (!rate || !this.ergPrice) {
        return new BigNumber(0);
      }

      return new BigNumber(rate).multipliedBy(this.ergPrice);
    },
    rate(tokenId: string): number {
      return this.$store.state.assetMarketRates[tokenId]?.erg ?? 0;
    },
    isErg(tokenId: string): boolean {
      return tokenId === ERG_TOKEN_ID;
    },
    urlFor(tokenId: string): string {
      return `${TOKEN_INFO_URL}${tokenId}`;
    }
  }
});
</script>
