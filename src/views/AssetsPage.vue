<template>
  <div class="flex flex-col gap-5">
    <div class="flex flex-row gap-3"></div>
    <div>
      <input type="text" placeholder="Search" class="control block w-full" />
    </div>
    <div class="flex flex-col">
      <div class="-my-2 -mx-8">
        <div class="py-2 align-middle inline-block min-w-full px-8">
          <div class="shadow overflow-hidden border-b border-gray-200 rounded-lg">
            <table class="table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th class="text-right">Balance</th>
                  <th class="relative w-20px"></th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <img :src="logoFor('erg')" class="w-6 h-6 inline-block mr-1" alt="ERG" />
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
                      class="w-6 h-6 inline-block mr-1"
                      :alt="asset.name"
                    />
                    <span class="align-middle"
                      >{{ $filters.compactString(asset.name, 20, "end") }}
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
