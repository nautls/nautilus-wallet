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
                  <th>Asset</th>
                  <th class="text-right">Balance</th>
                  <th class="w-20px relative"></th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <img :src="logoFor('erg')" class="h-6 mr-1 w-6 inline-block" alt="ERG" />
                    <span class="align-middle">ERG </span>
                  </td>
                  <td class="text-right whitespace-nowrap">
                    <p>{{ ergBalance }}</p>
                    <p class="text-xs text-gray-500" v-if="ergBalance > 0">
                      ≈{{ fiatBalance }} USD
                    </p>
                  </td>
                  <td class="relative">
                    <vue-feather type="send" size="16" />
                  </td>
                </tr>
                <tr v-for="asset in assetsBalance" :key="asset.tokenId">
                  <td>
                    <img
                      :src="logoFor(asset.tokenId)"
                      class="h-6 mr-1 w-6 inline-block"
                      :alt="asset.name"
                    />
                    <span class="align-middle"
                      ><template v-if="asset.name">{{
                        $filters.compactString(asset.name, 20, "end")
                      }}</template>
                      <template v-else>{{ $filters.compactString(asset.tokenId, 12) }}</template>
                    </span>
                  </td>
                  <td class="text-right">
                    {{ asset.amount.toLocaleString() }}
                  </td>
                  <td class="relative">
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

export default defineComponent({
  name: "AssetsPage",
  computed: {
    ...mapGetters({
      assetsBalance: "assetsBalance",
      ergBalance: "ergBalance",
      fiatBalance: "fiatBalance"
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
