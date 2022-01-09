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
    <div class="flex flex-col">
      <div class="-my-2 -mx-8">
        <div class="min-w-full py-2 px-8 align-middle inline-block">
          <div class="border-b rounded-lg border-gray-200 shadow">
            <table class="table">
              <thead>
                <tr>
                  <th colspan="2">Asset</th>
                  <th class="text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="loading" v-for="i in prevCount" :key="i">
                  <td class="w-14">
                    <img src="@/assets/images/defaultAssetLogo.svg" class="h-8 w-8 animate-pulse" />
                  </td>
                  <td>
                    <div class="skeleton h-3 w-2/3 rounded"></div>
                  </td>
                  <td class="text-right w-50">
                    <div class="skeleton h-3 w-3/5 rounded"></div>
                    <template v-if="i === 1">
                      <br />
                      <div class="skeleton h-3 w-2/5 rounded"></div>
                    </template>
                  </td>
                </tr>
                <tr v-else v-for="asset in assets" :key="asset.tokenId">
                  <td class="w-14">
                    <img
                      :src="$filters.assetLogo(asset.tokenId)"
                      class="h-8 w-8"
                      :alt="asset.name"
                    />
                  </td>
                  <td>
                    <span class="align-middle" :class="isErg(asset.tokenId) ? 'font-semibold' : ''"
                      ><template v-if="asset.name">{{
                        $filters.compactString(asset.name, 30, "end")
                      }}</template>
                      <template v-else>{{ $filters.compactString(asset.tokenId, 12) }}</template>
                    </span>
                  </td>
                  <td class="text-right">
                    <p>
                      {{ $filters.formatBigNumber(asset.confirmedAmount) }}
                    </p>
                    <tool-tip
                      :label="`1 ${asset.name} ≈ ${asset.price} USD`"
                      v-if="asset.price && !asset.confirmedAmount.isZero()"
                    >
                      <p class="text-xs text-gray-500">
                        ≈ {{ asset.confirmedAmount.multipliedBy(asset.price).toFormat(2) }} USD
                      </p>
                    </tool-tip>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { GETTERS } from "@/constants/store/getters";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import { StateAsset } from "@/types/internal";

export default defineComponent({
  name: "AssetsView",
  computed: {
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
    isErg(tokenId: string): boolean {
      return tokenId === ERG_TOKEN_ID;
    }
  }
});
</script>
