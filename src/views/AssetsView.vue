<template>
  <div class="flex flex-col gap-5">
    <div class="flex flex-row gap-3"></div>
    <div>
      <input type="text" v-model="filter" placeholder="Search" class="w-full control block" />
    </div>
    <div class="flex flex-col">
      <div class="-my-2 -mx-8">
        <div class="min-w-full py-2 px-8 align-middle inline-block">
          <div class="border-b rounded-lg border-gray-200 shadow overflow-hidden">
            <table class="table">
              <thead>
                <tr>
                  <th colspan="2">Asset</th>
                  <th class="text-right">Balance</th>
                  <th class="text-left w-11"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="asset in assets" :key="asset.tokenId">
                  <td class="w-14">
                    <img :src="logoFor(asset.tokenId)" class="h-8 w-8" :alt="asset.name" />
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
                    <p>{{ asset.amount.toFormat() }}</p>
                    <tool-tip
                      :label="`${asset.name} ≈ ${asset.price} USD`"
                      v-if="asset.price && !asset.amount.isZero()"
                    >
                      <p class="text-xs text-gray-500">
                        ≈ {{ asset.amount.multipliedBy(asset.price).toFormat(2) }} USD
                      </p>
                    </tool-tip>
                  </td>
                  <td class="text-right">
                    <vue-feather type="send" size="16" />
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
import { assetLogoMapper } from "@/mappers/assetLogoMapper";
import { GETTERS } from "@/constants/store/getters";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import { StateAsset } from "@/store/stateTypes";

export default defineComponent({
  name: "AssetsView",
  computed: {
    assets(): StateAsset[] {
      const assetList = this.$store.getters[GETTERS.ASSETS_BALANCE];

      if (this.filter !== "" && assetList.length > 0) {
        return assetList.filter((a: StateAsset) =>
          a.name?.toLocaleLowerCase().includes(this.filter.toLocaleLowerCase())
        );
      }

      return assetList;
    }
  },
  data() {
    return {
      filter: ""
    };
  },
  methods: {
    isErg(tokenId: string): boolean {
      return tokenId === ERG_TOKEN_ID;
    },
    logoFor(tokenId: string): string {
      const assetLogo = assetLogoMapper[tokenId];
      return `/icons/assets/${assetLogo ?? "default.svg"}`;
    }
  }
});
</script>
