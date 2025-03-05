<script setup lang="ts">
import { useVModel } from "@vueuse/core";
import { BigNumber } from "bignumber.js";
import { ChevronsUpDownIcon, Loader2Icon } from "lucide-vue-next";
import { AssetIcon, AssetInput } from "@/components/asset";
import { Button } from "@/components/ui/button";
import { Asset } from ".";

interface Props {
  loading?: boolean;
  assets: Asset[];
  selectedAsset: Asset;
  amount: BigNumber | undefined;
}

const props = defineProps<Props>();

const emits = defineEmits<{
  (e: "update:selectedAsset", payload: Asset): void;
  (e: "update:amount", payload: BigNumber): void;
}>();

const selectedAsset = useVModel(props, "selectedAsset", emits, { passive: true });
const amount = useVModel(props, "amount", emits, { passive: true });
</script>

<template>
  <AssetInput
    v-model="amount"
    input-class="text-lg"
    :validate="false"
    :asset="selectedAsset"
    class="gap-2 px-4 py-3"
  >
    <template #asset="{ asset, baseCurrencyName }">
      <Button class="px-2.5" variant="outline" @click.prevent.stop="console.log('swap')">
        <AssetIcon class="size-4" :token-id="asset.tokenId" :type="asset.metadata?.type" />
        {{ baseCurrencyName }}

        <Loader2Icon v-if="props.loading" class="size-4 animate-spin opacity-50" />
        <ChevronsUpDownIcon v-else class="size-4 opacity-50" />
      </Button>
    </template>
  </AssetInput>
</template>
