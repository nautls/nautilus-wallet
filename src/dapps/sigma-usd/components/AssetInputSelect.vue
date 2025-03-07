<script setup lang="ts">
import { useVModel } from "@vueuse/core";
import { BigNumber } from "bignumber.js";
import { ChevronsUpDownIcon, Loader2Icon } from "lucide-vue-next";
import { AssetIcon, AssetInput, AssetSelect } from "@/components/asset";
import { Button } from "@/components/ui/button";
import { PopoverTrigger } from "@/components/ui/popover";
import { bn } from "@/common/bigNumber";
import { Asset } from ".";

const EMPTY_ASSET: Asset = { tokenId: "EMPTY_ASSET", balance: bn(0) };

interface Props {
  loading?: boolean;
  assets: Asset[];
  selectedAsset: Asset | undefined;
  amount: BigNumber | undefined;
  disabled?: boolean;
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
    :disabled="!selectedAsset || props.disabled"
    :asset="selectedAsset ?? EMPTY_ASSET"
    class="gap-2 px-4 py-3"
  >
    <template #asset="{ asset, baseCurrencyName }">
      <AssetSelect v-model="selectedAsset" :assets="props.assets">
        <PopoverTrigger as-child>
          <Button
            :disabled="props.disabled"
            :variant="selectedAsset ? 'outline' : 'default'"
            class="px-2.5"
            @click.prevent.stop
          >
            <template v-if="selectedAsset">
              <AssetIcon class="size-4" :token-id="asset.tokenId" :type="asset.metadata?.type" />
              {{ baseCurrencyName }}
            </template>
            <div v-else class="pl-1">Select</div>

            <Loader2Icon v-if="props.loading" class="size-4 animate-spin opacity-50" />
            <ChevronsUpDownIcon v-else class="size-4 opacity-50" />
          </Button>
        </PopoverTrigger>
      </AssetSelect>
    </template>
  </AssetInput>
</template>
