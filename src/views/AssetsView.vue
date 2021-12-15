<template>
  <div class="flex flex-col gap-5">
    <div class="flex flex-row gap-3"></div>
    <div>
      <input type="text" placeholder="Search" class="w-full control block" />
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
                <tr>
                  <td class="w-12">
                    <img :src="logoFor('erg')" class="h-6 w-6 inline-block" alt="ERG" />
                  </td>
                  <td>
                    <span class="align-middle">ERG </span>
                  </td>
                  <td class="text-right whitespace-nowrap">
                    <p>{{ ergBalance }}</p>
                    <p class="text-xs text-gray-500" v-if="ergBalance > 0">
                      ≈{{ fiatBalance }} USD
                    </p>
                  </td>
                  <td class="text-right">
                    <vue-feather type="send" size="16" />
                  </td>
                </tr>
                <tr v-for="asset in assetsBalance" :key="asset.tokenId">
                  <td>
                    <img
                      :src="logoFor(asset.tokenId)"
                      class="h-6 w-6 inline-block"
                      :alt="asset.name"
                    />
                  </td>
                  <td>
                    <span class="align-middle"
                      ><template v-if="asset.name">{{
                        $filters.compactString(asset.name, 30, "end")
                      }}</template>
                      <template v-else>{{ $filters.compactString(asset.tokenId, 12) }}</template>
                    </span>
                  </td>
                  <td class="text-right">
                    {{ asset.amount.toLocaleString() }}
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
import { mapGetters } from "vuex";
import { defineComponent } from "vue";
import { assetLogoIndex } from "@/utils/assetLogoIndex";
import { ASSETS_BALANCE, ERG_BALANCE, FIAT_BALANCE } from "@/constants/store/getters";

export default defineComponent({
  name: "AssetsView",
  computed: {
    ...mapGetters({
      assetsBalance: ASSETS_BALANCE,
      ergBalance: ERG_BALANCE,
      fiatBalance: FIAT_BALANCE
    })
  },
  props: {
    title: { type: String, require: true },
    backButton: { type: Boolean, default: false }
  },
  methods: {
    logoFor(tokenId: string): string {
      const assetLogo = assetLogoIndex[tokenId];
      return `/icons/assets/${assetLogo ?? "default.svg"}`;
    }
  }
});
</script>
