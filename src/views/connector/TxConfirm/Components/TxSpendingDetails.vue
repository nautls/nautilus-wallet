<template>
  <div class="flex flex-col border rounded" :class="boxStyles">
    <div class="border-b-1 px-3 py-2 font-semibold rounded rounded-b-none" :class="headerStyles">
      <slot />

      <div class="text-xs font-normal text-gray-600 pt-1" v-if="$slots.subheader">
        <slot name="subheader" />
      </div>
    </div>

    <ul class="px-3 py-1">
      <li v-for="asset in assets">
        <div class="flex flex-row items-center gap-2 py-1">
          <asset-icon class="h-7 w-7" :token-id="asset.tokenId" />
          <div class="flex-grow items-center align-middle">
            <span class="align-middle">
              <template v-if="asset.name">{{
                $filters.compactString(asset.name, 20, "end")
              }}</template>
              <template v-else>{{ $filters.compactString(asset.tokenId, 20) }}</template>
            </span>
            <tool-tip v-if="asset.minting" class="align-middle">
              <template v-slot:label>
                <div class="block w-38">
                  <span>This asset is being minted by this transaction.</span>
                  <div class="text-left pt-2">
                    <p v-if="asset.description">
                      <span class="font-bold">Description</span>:
                      {{ $filters.compactString(asset.description, 50, "end") }}
                    </p>
                    <p v-if="asset.decimals">
                      <span class="font-bold">Decimals</span>: {{ asset.decimals }}
                    </p>
                  </div>
                </div>
              </template>
              <vue-feather type="git-commit" class="align-middle pl-2" size="18" />
            </tool-tip>
          </div>
          <div>
            {{ $filters.formatBigNumber(asset.amount) }}
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

<script lang="ts">
import { OutputAsset } from "@/api/ergo/transaction/interpreter/outputInterpreter";
import { defineComponent, PropType } from "vue";

export default defineComponent({
  name: "ImageSandbox",
  props: {
    assets: { type: Array as PropType<Array<OutputAsset>> },
    type: {
      type: String as PropType<"normal" | "danger" | "warning" | "info" | "success">,
      default: "normal"
    }
  },
  computed: {
    boxStyles() {
      switch (this.type) {
        case "danger":
          return "border-red-300 bg-red-50";
        case "warning":
          return "border-yellow-300";
        case "info":
          return "border-blue-300";
        case "success":
          return "border-green-300";
        case "normal":
        default:
          return "border-gray-300";
      }
    },
    headerStyles() {
      switch (this.type) {
        case "danger":
          return "bg-red-100 border-red-300 text-red-900";
        case "warning":
          return "bg-yellow-100 border-yellow-300 text-yellow-900";
        case "info":
          return "bg-blue-100 border-blue-300 text-blue-900";
        case "success":
          return "bg-green-100 border-green-300 text-green-900";
        case "normal":
        default:
          return "bg-gray-100 border-gray-300";
      }
    }
  }
});
</script>
