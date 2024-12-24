<template>
  <div class="flex flex-col rounded border shadow-sm" :class="boxStyles">
    <div class="border-b-1 rounded rounded-b-none px-3 py-2 font-semibold" :class="headerStyles">
      <div class="flex w-full flex-row items-center">
        <div class="flex w-full">
          <p v-if="loading" class="skeleton h-5 w-3/5 rounded"></p>
          <template v-else>
            <slot />
          </template>
        </div>
        <div v-if="babelSwap" class="flex-shrink"><babel-badge class="h-5 w-5 align-middle" /></div>
      </div>

      <div v-if="loading" class="pt-2">
        <p class="skeleton h-3 w-full rounded"></p>
        <p class="skeleton mt-1 h-3 w-2/5 rounded"></p>
      </div>
      <div v-else-if="$slots.subheader" class="pt-1 text-xs font-normal">
        <slot name="subheader" />
      </div>
    </div>

    <ul class="px-3 py-1">
      <li v-if="loading">
        <div class="flex flex-row items-center gap-2 py-1">
          <empty-logo class="h-7 w-7 animate-pulse fill-gray-300" />
          <div class="flex-grow items-center align-middle">
            <div class="skeleton h-4 w-2/5 rounded"></div>
          </div>
          <div class="skeleton h-4 w-1/6 rounded"></div>
        </div>
      </li>
      <template v-else>
        <li v-for="(asset, index) in assets" :key="index">
          <div
            v-if="babelSwap && isErg(asset.tokenId) && assets.length > 1"
            class="py-2 text-center"
          >
            <arrow-down-up-icon class="inline align-middle text-gray-600" />
          </div>
          <div class="flex flex-row items-center gap-2 py-1">
            <asset-icon class="h-7 w-7" :token-id="asset.tokenId" />
            <div class="flex-grow items-center align-middle">
              <span class="align-middle">
                <template v-if="asset.name">{{
                  format.string.shorten(asset.name, 20, "end")
                }}</template>
                <template v-else>{{ format.string.shorten(asset.tokenId, 20) }}</template>
              </span>
              <tool-tip v-if="asset.minting" class="align-middle">
                <template #label>
                  <div class="w-38 block">
                    <span>This asset is being minted on this transaction.</span>
                    <div class="pt-2 text-left">
                      <p v-if="asset.description">
                        <span class="font-bold">Description</span>:
                        {{ format.string.shorten(asset.description, 50, "end") }}
                      </p>
                      <p v-if="asset.decimals">
                        <span class="font-bold">Decimals</span>: {{ asset.decimals }}
                      </p>
                    </div>
                  </div>
                </template>
                <git-commit-vertical-icon class="pl-2 align-middle" />
              </tool-tip>
            </div>
            <div>
              {{ format.bn.format(asset.amount) }}
            </div>
          </div>
        </li>
      </template>
    </ul>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from "vue";
import { ArrowDownUpIcon, GitCommitVerticalIcon } from "lucide-vue-next";
import BabelBadge from "@/assets/images/babel-badge.svg";
import EmptyLogo from "@/assets/images/tokens/asset-empty.svg";
import { OutputAsset } from "@/chains/ergo/transaction/interpreter/outputInterpreter";
import { useFormat } from "@/composables/useFormat";
import { ERG_TOKEN_ID } from "@/constants/ergo";

export default defineComponent({
  name: "TxBoxDetails",
  components: {
    BabelBadge,
    EmptyLogo,
    ArrowDownUpIcon,
    GitCommitVerticalIcon
  },
  props: {
    assets: { type: Array as PropType<Array<OutputAsset>>, default: () => [] },
    babelSwap: { type: Boolean },
    loading: { type: Boolean },
    type: {
      type: String as PropType<"default" | "danger" | "warning" | "info" | "success">,
      default: "default"
    }
  },
  setup() {
    return { format: useFormat() };
  },
  computed: {
    boxStyles() {
      switch (this.type) {
        case "danger":
          return "border-red-200 bg-red-50";
        case "warning":
          return "border-yellow-200";
        case "info":
          return "border-blue-200";
        case "success":
          return "border-green-200";
        case "default":
        default:
          return "border-gray-200";
      }
    },
    headerStyles() {
      switch (this.type) {
        case "danger":
          return "bg-red-100 border-b-red-200 text-red-900";
        case "warning":
          return "bg-yellow-100 border-b-yellow-200 text-yellow-900";
        case "info":
          return "bg-blue-100 border-b-blue-200 text-blue-900";
        case "success":
          return "bg-green-100 border-b-green-200 text-green-900";
        case "default":
        default:
          return "bg-gray-100 border-b-gray-200 text-gray-900";
      }
    }
  },
  methods: {
    isErg(tokenId: string): boolean {
      return tokenId === ERG_TOKEN_ID;
    }
  }
});
</script>
