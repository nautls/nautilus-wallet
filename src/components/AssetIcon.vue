<template>
  <img v-if="hasLogo" :src="logo" :class="class" />
  <template v-else>
    <picture-nft-icon
      v-if="isPictureNft"
      :class="class"
      class="fill-gray-300"
      :style="`fill: ${calculateColor(tokenId)}`"
    />
    <audio-nft-icon
      v-else-if="isAudioNft"
      :class="class"
      class="fill-gray-300"
      :style="`fill: ${calculateColor(tokenId)}`"
    />
    <video-nft-icon
      v-else-if="isVideoNft"
      :class="class"
      class="fill-gray-300"
      :style="`fill: ${calculateColor(tokenId)}`"
    />
    <empty-icon
      v-else
      :class="class"
      class="fill-gray-300"
      :style="`fill: ${calculateColor(tokenId)}`"
    />
  </template>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import EmptyIcon from "@/assets/images/tokens/asset-empty.svg";
import PictureNftIcon from "@/assets/images/tokens/asset-nft-picture.svg";
import AudioNftIcon from "@/assets/images/tokens/asset-nft-audio.svg";
import VideoNftIcon from "@/assets/images/tokens/asset-nft-video.svg";
import { logoMapper } from "@/mappers/logoMapper";
import { AssetSubtype } from "@/types/internal";
import { isEmpty } from "lodash";

export default defineComponent({
  name: "AssetIcon",
  components: {
    EmptyIcon,
    PictureNftIcon,
    AudioNftIcon,
    VideoNftIcon
  },
  props: {
    tokenId: { type: String, required: true },
    class: { type: String, required: false },
    type: { type: String, required: false }
  },
  computed: {
    logo(): string | undefined {
      const logoFile = logoMapper[this.tokenId];
      if (logoFile) {
        return `/icons/assets/${logoFile}`;
      }
    },
    hasLogo(): boolean {
      return this.logo !== undefined;
    },
    isPictureNft(): boolean {
      return this.type === AssetSubtype.PictureArtwork;
    },
    isAudioNft(): boolean {
      return this.type === AssetSubtype.AudioArtwork;
    },
    isVideoNft(): boolean {
      return this.type === AssetSubtype.VideoArtwork;
    }
  },
  methods: {
    calculateColor(tokenId: string) {
      if (isEmpty(tokenId)) {
        return;
      }

      const brightness = 0.7;
      let r = parseInt(tokenId.substring(0, 2), 16);
      let g = parseInt(tokenId.substring(2, 4), 16);
      let b = parseInt(tokenId.substring(4, 6), 16);
      r = r + (256 - r) * brightness;
      g = g + (256 - g) * brightness;
      b = b + (256 - b) * brightness;

      return `rgb(${r},${g},${b})`;
    }
  }
});
</script>
