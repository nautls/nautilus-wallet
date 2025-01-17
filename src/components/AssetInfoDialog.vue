<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { BracesIcon, HandCoinsIcon, KeyRoundIcon, MilestoneIcon } from "lucide-vue-next";
import AssetIcon from "@/components/AssetIcon.vue";
import ImageSandbox from "@/components/ImageSandbox.vue";
import StatsCard from "@/components/StatsCard.vue";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { bn, decimalize } from "@/common/bigNumber";
import { useFormat } from "@/composables/useFormat";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import { assetInfoDbService } from "@/database/assetInfoDbService";
import { IAssetInfo } from "@/types/database";
import { AssetSubtype } from "@/types/internal";

interface Props {
  tokenId: string;
}

type JsonDescription = {
  title?: string;
  meta?: Map<string, string>;
};

const format = useFormat();

const props = defineProps<Props>();
const emit = defineEmits(["close"]);

const opened = ref(true);
const asset = ref(Object.freeze({} as IAssetInfo | undefined));

const emissionAmount = computed(() => {
  if (!asset.value?.emissionAmount) return "";

  let amount = bn(asset.value.emissionAmount);
  if (asset.value.decimals) {
    amount = decimalize(amount, asset.value.decimals);
  }

  return format.bn.format(amount ?? bn(0), undefined, Number.MAX_SAFE_INTEGER);
});

const isImageNft = computed(() => {
  return asset.value?.subtype === AssetSubtype.PictureArtwork;
});

const contentUrl = computed(() => {
  if (!asset.value?.artworkUrl && !asset.value?.artworkCover) return;
  return asset.value.artworkUrl ?? asset.value.artworkCover;
});

const description = computed((): JsonDescription => {
  if (!asset.value?.description) return {};

  if (
    (asset.value.description.startsWith("{") && asset.value.description.endsWith("}")) ||
    (asset.value.description.startsWith("[") && asset.value.description.endsWith("]"))
  ) {
    try {
      const parsed = JSON.parse(asset.value.description);
      const obj: JsonDescription = {};
      const map = new Map<string, string>();
      let count = 0;

      for (const key in parsed) {
        const type = typeof parsed[key];
        if (key.startsWith("_")) continue;
        if (!obj.title && (key.toLowerCase() === "title" || key.toLowerCase() === "description")) {
          obj.title = parsed[key];
          continue;
        }

        // avoid too many data points
        if (count <= 6) {
          count++;
        } else {
          break;
        }

        switch (type) {
          case "bigint":
          case "boolean":
          case "number":
            map.set(expandCamelCase(key), String(parsed[key]));
            break;
          case "object":
            map.set(expandCamelCase(key), JSON.stringify(parsed[key], null, 2));
            break;
          case "string":
            map.set(expandCamelCase(key), parsed[key]);
            break;
          default:
            break;
        }
      }

      if (map.size) obj.meta = map;
      return obj;
    } catch {
      return { title: asset.value.description };
    }
  }

  return { title: asset.value.description };
});

function expandCamelCase(str: string): string {
  // Split the string at each uppercase letter and join with a space
  return str
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, function (match) {
      return match.toUpperCase();
    })
    .trim();
}

watch(() => props.tokenId, getAssetInfo, { immediate: true });

async function getAssetInfo() {
  if (!props.tokenId || props.tokenId === ERG_TOKEN_ID) return;
  asset.value = Object.freeze(await assetInfoDbService.get(props.tokenId));
}

function handleOpenUpdates(open: boolean) {
  if (!open) emit("close");
}

function openDialog() {
  opened.value = true;
}

function closeDialog(): void {
  opened.value = false;
}

defineExpose({ open: openDialog, close: closeDialog });
</script>

<template>
  <Dialog v-model:open="opened" @update:open="handleOpenUpdates">
    <DialogContent
      class="sm:max-w-[410px] sm:h-auto"
      :class="isImageNft ? 'h-[90dvh]' : 'h-[70dvh]'"
    >
      <AssetIcon
        v-if="!isImageNft"
        class="absolute -top-12 left-0 right-0 mx-auto size-20"
        :token-id="asset?.id ?? tokenId"
        :type="asset?.subtype"
      />

      <DialogHeader :class="{ 'pt-5': !isImageNft }">
        <DialogTitle>
          <div class="max-w-[280px] w-fit truncate xs:m-auto leading-tight">
            {{ asset?.name ?? asset?.id }}
          </div>
        </DialogTitle>
        <DialogDescription v-if="description.title" class="max-w-[360px]">
          <ScrollArea type="hover">
            <div class="max-h-16" :class="{ 'break-all': !description.title.includes(' ') }">
              {{ description.title }}
            </div>
          </ScrollArea>
        </DialogDescription>
      </DialogHeader>

      <ScrollArea type="hover" class="-mx-6 flex-grow">
        <div class="flex flex-col gap-4 px-6">
          <div v-if="isImageNft && contentUrl" class="relative">
            <ImageSandbox
              display-external-link
              :src="contentUrl"
              object-fit="cover"
              class="w-full rounded-md min-h-[240px] border-input border"
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <StatsCard
              class="col-span-2"
              title="Emission Amount"
              :content="emissionAmount"
              :icon="HandCoinsIcon"
            />
            <StatsCard title="Token ID" :content="asset?.id ?? ''" :icon="KeyRoundIcon" />
            <StatsCard
              title="Mint TXID"
              :content="asset?.mintingTransactionId ?? ''"
              :icon="MilestoneIcon"
            />
          </div>

          <template v-if="description.meta && description.meta.size">
            <Separator label="Additional Metadata" class="my-2" />

            <div class="grid grid-cols-1 gap-4">
              <StatsCard
                v-for="kv in description.meta"
                :key="kv[0]"
                :title="kv[0]"
                :content="kv[1]"
                :icon="BracesIcon"
              />
            </div>
          </template>
        </div>
      </ScrollArea>

      <DialogFooter>
        <DialogClose as-child>
          <Button variant="outline" type="submit">Close</Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
