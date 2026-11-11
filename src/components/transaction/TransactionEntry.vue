<script setup lang="ts">
import { HTMLAttributes } from "vue";
import { ArrowDownIcon, MilestoneIcon } from "@lucide/vue";
import { useI18n } from "vue-i18n";
import {
  AssetIcon,
  AssetInfoDialog,
  AssetSignIcon,
  AssetSignIconVariants
} from "@/components/asset";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { OutputAsset } from "@/chains/ergo/transaction/interpreter/outputInterpreter";
import { cn, isErg } from "@/common/utils";
import { useFormat } from "@/composables/useFormat";
import { useProgrammaticDialog } from "@/composables/useProgrammaticDialog";
import { IAssetInfo } from "@/types/database";
import { AssetType } from "@/types/internal";
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
const { open: openAssetInfoDialog } = useProgrammaticDialog(AssetInfoDialog);

function openMintingInfo(asset: OutputAsset) {
  if (!asset.minting) return;

  const { tokenId, emissionAmount, metadata } = asset.minting;
  const info: IAssetInfo = {
    id: tokenId,
    mintingBoxId: tokenId,
    type: AssetType.Unknown,
    name: metadata?.name,
    description: metadata?.description,
    decimals: metadata?.decimals,
    emissionAmount: emissionAmount.toString()
  };

  openAssetInfoDialog({ tokenId, preview: info, minting: true });
}
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
            <AssetIcon
              class="size-9 shrink-0"
              :token-id="asset.tokenId"
              :type="asset.metadata?.type"
            />
            <div
              class="flex min-w-0 grow flex-col justify-center"
              :class="{ 'font-semibold': isErg(asset.tokenId) }"
            >
              <div class="truncate leading-tight">
                {{ format.asset.name(asset) }}
              </div>
              <div class="flex items-center gap-1.5 text-xs">
                <span class="opacity-60">{{ format.asset.id(asset.tokenId) }}</span>
                <button
                  v-if="asset.minting"
                  type="button"
                  class="text-success bg-success/10 hover:bg-success/20 focus-visible:ring-ring inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.65rem] leading-none font-semibold whitespace-nowrap outline-none focus-visible:ring-1"
                  :aria-label="t('transaction.sign.newTokenDetails')"
                  @click="openMintingInfo(asset)"
                >
                  <MilestoneIcon class="size-3" />
                  {{ t("transaction.sign.newToken") }}
                </button>
              </div>
            </div>
            <div class="text-right align-middle whitespace-nowrap tabular-nums">
              {{ format.number.decimal(asset.amount) }}
            </div>
          </div>
        </div>
      </template>
    </CardContent>
  </Card>
</template>
