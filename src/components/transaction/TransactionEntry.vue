<script setup lang="ts">
import { HTMLAttributes } from "vue";
import { ArrowDownIcon, MilestoneIcon } from "lucide-vue-next";
import { AssetSignIcon, AssetSignIconVariants } from "@/components/asset";
import AssetIcon from "@/components/AssetIcon.vue";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { OutputAsset } from "@/chains/ergo/transaction/interpreter/outputInterpreter";
import { isErg } from "@/common/utils";
import { useFormat } from "@/composables/useFormat";
import { cn } from "@/lib/utils";
import { cardVariants, type CardVariants } from ".";

interface Props {
  assets: Array<OutputAsset>;
  loading?: boolean;
  type?: AssetSignIconVariants["variant"];
  variant?: CardVariants["variant"];
  class?: HTMLAttributes["class"];
}

const props = withDefaults(defineProps<Props>(), {
  variant: "default",
  type: "positive",
  class: undefined
});

const format = useFormat();
</script>

<template>
  <Card :class="cn(cardVariants({ variant }), props.class)">
    <CardHeader>
      <CardTitle class="flex flex-row items-center justify-between gap-2 text-sm">
        <div class="font-semibold leading-none tracking-tight"><slot /></div>
        <AssetSignIcon :type="props.type" class="size-4" />
      </CardTitle>
      <CardDescription v-if="$slots.subheader" class="text-xs">
        <slot name="subheader"
      /></CardDescription>
    </CardHeader>

    <CardContent class="flex flex-col gap-3">
      <div v-for="(asset, index) in assets" :key="index">
        <div v-if="type === 'swap' && assets.length > 1 && index == 1" class="pb-2 w-full">
          <ArrowDownIcon class="m-auto size-4 text-muted-foreground" />
        </div>

        <div class="flex flex-row gap-2 items-center">
          <AssetIcon class="size-9" :token-id="asset.tokenId" :type="asset.metadata?.type" />
          <div
            class="flex flex-grow flex-col justify-center"
            :class="{ 'font-semibold': isErg(asset.tokenId) }"
          >
            <div class="leading-tight">
              {{ format.asset.name(asset) }}

              <TooltipProvider v-if="asset.minting" :delay-duration="100">
                <Tooltip>
                  <TooltipTrigger class="inline align-middle text-success">
                    <MilestoneIcon class="size-3.5" />
                  </TooltipTrigger>
                  <TooltipContent class="text-center px-3 py-2 w-48">
                    <p class="font-semibold">New Token</p>
                    <p class="text-xs">This token will be minted in this transaction.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div class="text-xs opacity-60">
              {{ isErg(asset.tokenId) ? "Ergo" : format.string.shorten(asset.tokenId, 7, "none") }}
            </div>
          </div>
          <div class="whitespace-nowrap text-right align-middle">
            <div>
              {{ format.bn.format(asset.amount) }}
            </div>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
