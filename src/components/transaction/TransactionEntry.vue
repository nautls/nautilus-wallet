<script setup lang="ts">
import { HTMLAttributes } from "vue";
import { ArrowDownIcon, MilestoneIcon } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import { AssetIcon, AssetSignIcon, AssetSignIconVariants } from "@/components/asset";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { OutputAsset } from "@/chains/ergo/transaction/interpreter/outputInterpreter";
import { cn, isErg } from "@/common/utils";
import { useFormat } from "@/composables/useFormat";
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
const { t } = useI18n();
</script>

<template>
  <Card :class="cn(cardVariants({ variant }), props.class)">
    <CardHeader>
      <template v-if="props.loading">
        <CardTitle class="flex flex-row items-center justify-between gap-2">
          <Skeleton class="h-5 w-40" />
          <Skeleton class="size-5" />
        </CardTitle>
      </template>
      <template v-else>
        <CardTitle class="flex flex-row items-center justify-between gap-2">
          <div class="leading-none font-semibold tracking-tight"><slot /></div>
          <AssetSignIcon :type="props.type" class="size-4" />
        </CardTitle>
        <CardDescription v-if="$slots.subheader" class="text-xs">
          <slot name="subheader"
        /></CardDescription>
      </template>
    </CardHeader>

    <CardContent class="flex flex-col gap-3">
      <template v-if="props.loading">
        <div class="flex flex-row items-center gap-2 p-0">
          <Skeleton v-if="loading" class="size-9 rounded-full" />

          <div class="flex grow flex-col justify-center">
            <Skeleton class="h-4 w-20" />
            <Skeleton class="mt-1 h-3 w-16" />
          </div>
          <div class="text-right align-middle whitespace-nowrap">
            <Skeleton class="h-4 w-16" />
          </div>
        </div>
      </template>
      <template v-else>
        <div v-for="(asset, index) in assets" :key="index">
          <div v-if="type === 'swap' && assets.length > 1 && index == 1" class="w-full pb-2">
            <ArrowDownIcon class="text-muted-foreground m-auto size-4" />
          </div>

          <div class="flex flex-row items-center gap-2">
            <AssetIcon class="size-9" :token-id="asset.tokenId" :type="asset.metadata?.type" />
            <div
              class="flex grow flex-col justify-center"
              :class="{ 'font-semibold': isErg(asset.tokenId) }"
            >
              <div class="leading-tight">
                {{ format.asset.name(asset) }}

                <TooltipProvider v-if="asset.minting" :delay-duration="100">
                  <Tooltip>
                    <TooltipTrigger class="text-success inline align-middle">
                      <MilestoneIcon class="size-3.5" />
                    </TooltipTrigger>
                    <TooltipContent class="w-48 px-3 py-2 text-center" v-once>
                      <p class="font-semibold">{{ t("transaction.sign.newToken") }}</p>
                      <p class="text-xs">{{ t("transaction.sign.newTokenDesc") }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div class="text-xs opacity-60">
                {{
                  isErg(asset.tokenId) ? "Ergo" : format.string.shorten(asset.tokenId, 7, "none")
                }}
              </div>
            </div>
            <div class="text-right align-middle whitespace-nowrap">
              {{ format.bn.format(asset.amount) }}
            </div>
          </div>
        </div>
      </template>
    </CardContent>
  </Card>
</template>
