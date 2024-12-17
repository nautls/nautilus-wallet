<script setup lang="ts">
import { nextTick, onMounted, PropType, ref, shallowRef } from "vue";
import { WalletChecksum, walletChecksum } from "@emurgo/cip4-js";
import { renderIcon } from "@download/blockies";
import { hex } from "@fleet-sdk/crypto";
import { VenetianMaskIcon } from "lucide-vue-next";
import { IDbWallet } from "@/types/database";
import { WalletType } from "@/types/internal";
import { mountExtendedPublicKey } from "@/common/serializer";

const COLORS = [
  ["#17d1aa", "#e1f2ff", "#a80b32"],
  ["#fa5380", "#e1f2ff", "#0833b2"],
  ["#f06ef5", "#e1f2ff", "#0804f7"],
  ["#ebb687", "#e1f2ff", "#852d62"],
  ["#f59f9a", "#e1f2ff", "#085f48"]
];

const props = defineProps({
  wallet: { type: Object as PropType<IDbWallet>, required: true },
  loading: { type: Boolean, default: false },
  reverse: { type: Boolean, default: false }
});

const checksum = shallowRef<WalletChecksum>();
const canvasId = ref(`wlt-${props.wallet.id}-${crypto.randomUUID()}-checksum`);

onMounted(() => {
  const xpk = mountExtendedPublicKey(props.wallet.publicKey, props.wallet.chainCode);
  checksum.value = walletChecksum(xpk);

  const colorIdx = hex.decode(checksum.value.ImagePart)[0] % COLORS.length;
  const [color, bgcolor, spotcolor] = COLORS[colorIdx];

  nextTick(() => {
    renderIcon(
      {
        seed: checksum.value?.ImagePart,
        size: 7,
        scale: 4,
        color,
        bgcolor,
        spotcolor
      },
      document.getElementById(canvasId.value)
    );
  });
});

function walletTypeToString(type: WalletType): string {
  switch (type) {
    case WalletType.Standard:
      return "Standard";
    case WalletType.ReadOnly:
      return "Read-only";
    case WalletType.Ledger:
      return "Ledger";
    default:
      return "";
  }
}
</script>

<template>
  <div class="flex flex-row gap-3 items-center w-full h-10">
    <div class="flex flex-col gap-0.5 h-full w-full text-left whitespace-nowrap">
      <div class="font-semibold text-sm w-40 h-full truncate" :class="{ 'text-right': reverse }">
        {{ wallet.name }}
      </div>
      <div
        class="h-full text-xs flex items-center flex-row gap-1"
        :class="{ 'flex-row-reverse': reverse }"
      >
        <small class="align-middle font-normal">{{ checksum?.TextPart }}</small>
        <small class="rounded bg-gray-200 px-1 font-normal text-dark-200 uppercase">{{
          walletTypeToString(wallet.type)
        }}</small>
        <venetian-mask-icon v-if="wallet.settings.avoidAddressReuse" class="h-4 w-4" />
        <loading-indicator v-if="loading" class="w-4 h-4" />
      </div>
    </div>

    <canvas
      :id="canvasId"
      class="rounded w-9 h-9 ring-1 ring-gray-300 ring-offset-1 inline-block"
    ></canvas>
  </div>
</template>
