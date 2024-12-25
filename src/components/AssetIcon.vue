<script setup lang="ts">
import { computed, HTMLAttributes } from "vue";
import ErgoLogo from "@/assets/images/ergo.svg";
import EmptyIcon from "@/assets/images/tokens/asset-empty.svg";
import AudioNftIcon from "@/assets/images/tokens/asset-nft-audio.svg";
import PictureNftIcon from "@/assets/images/tokens/asset-nft-picture.svg";
import VideoNftIcon from "@/assets/images/tokens/asset-nft-video.svg";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import { cn } from "@/lib/utils";
import { assetIconMap } from "@/mappers/assetIconMap";
import { AssetSubtype } from "@/types/internal";

const DEFAULT_FILLING_COLOR_BRIGHTNESS = 0.7;

const props = defineProps<{
  tokenId: string;
  class?: HTMLAttributes["class"];
  type?: string;
}>();

const logo = computed(() => {
  const fileName = assetIconMap.get(props.tokenId);
  if (fileName) return `/icons/assets/${fileName}`;

  return undefined;
});

function calculateFillingColor(tokenId: string) {
  if (!tokenId || tokenId === ERG_TOKEN_ID) return;

  let r = Number.parseInt(tokenId.substring(0, 2), 16);
  let g = Number.parseInt(tokenId.substring(2, 4), 16);
  let b = Number.parseInt(tokenId.substring(4, 6), 16);
  r = r + (256 - r) * DEFAULT_FILLING_COLOR_BRIGHTNESS;
  g = g + (256 - g) * DEFAULT_FILLING_COLOR_BRIGHTNESS;
  b = b + (256 - b) * DEFAULT_FILLING_COLOR_BRIGHTNESS;

  return `fill: rgb(${r},${g},${b})`;
}

const genericIcon = computed(() => {
  if (props.tokenId === ERG_TOKEN_ID) return ErgoLogo;
  if (props.type === AssetSubtype.PictureArtwork) return PictureNftIcon;
  if (props.type === AssetSubtype.AudioArtwork) return AudioNftIcon;
  if (props.type === AssetSubtype.VideoArtwork) return VideoNftIcon;
  return EmptyIcon;
});
</script>

<template>
  <img v-if="logo" :src="logo" :class="props.class" />
  <template v-else>
    <component
      :is="genericIcon"
      :class="cn(props.class, 'fill-foreground')"
      :style="calculateFillingColor(tokenId)"
    />
  </template>
</template>
