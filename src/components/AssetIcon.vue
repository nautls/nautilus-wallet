<script setup lang="ts">
import { computed, HtmlHTMLAttributes } from "vue";
import { isEmpty } from "@fleet-sdk/common";
import EmptyIcon from "@/assets/images/tokens/asset-empty.svg";
import PictureNftIcon from "@/assets/images/tokens/asset-nft-picture.svg";
import AudioNftIcon from "@/assets/images/tokens/asset-nft-audio.svg";
import VideoNftIcon from "@/assets/images/tokens/asset-nft-video.svg";
import { assetIconMap } from "@/mappers/assetIconMap";
import { AssetSubtype } from "@/types/internal";

const props = defineProps<{
  tokenId: string;
  class?: HtmlHTMLAttributes["class"];
  type?: string;
}>();

const logo = computed(() => {
  const fileName = assetIconMap[props.tokenId];
  if (fileName) return `/icons/assets/${fileName}`;

  return undefined;
});

function calculateColor(tokenId: string) {
  if (isEmpty(tokenId)) return;

  const brightness = 0.7;
  let r = parseInt(tokenId.substring(0, 2), 16);
  let g = parseInt(tokenId.substring(2, 4), 16);
  let b = parseInt(tokenId.substring(4, 6), 16);
  r = r + (256 - r) * brightness;
  g = g + (256 - g) * brightness;
  b = b + (256 - b) * brightness;

  return `rgb(${r},${g},${b})`;
}

function is(type: AssetSubtype): boolean {
  return props.type === type;
}
</script>

<template>
  <img v-if="logo" :src="logo" :class="props.class" />
  <template v-else>
    <picture-nft-icon
      v-if="is(AssetSubtype.PictureArtwork)"
      :class="props.class"
      class="fill-muted"
      :style="`fill: ${calculateColor(tokenId)}`"
    />
    <audio-nft-icon
      v-else-if="is(AssetSubtype.AudioArtwork)"
      :class="props.class"
      class="fill-muted"
      :style="`fill: ${calculateColor(tokenId)}`"
    />
    <video-nft-icon
      v-else-if="is(AssetSubtype.VideoArtwork)"
      :class="props.class"
      class="fill-muted"
      :style="`fill: ${calculateColor(tokenId)}`"
    />
    <empty-icon
      v-else
      :class="props.class"
      class="fill-muted"
      :style="`fill: ${calculateColor(tokenId)}`"
    />
  </template>
</template>
