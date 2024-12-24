<script setup lang="ts">
import { nextTick, onMounted, PropType, ref, shallowRef } from "vue";
import { renderIcon } from "@download/blockies";
import { WalletChecksum, walletChecksum } from "@emurgo/cip4-js";
import { hex } from "@fleet-sdk/crypto";
import { VenetianMaskIcon } from "lucide-vue-next";
import { mountExtendedPublicKey } from "@/common/serializer";
import { IDbWallet } from "@/types/database";
import { WalletType } from "@/types/internal";

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
  <div class="flex h-10 w-full flex-row items-center gap-3">
    <div class="flex h-full w-full flex-col gap-0.5 whitespace-nowrap text-left">
      <div class="h-full w-40 truncate text-sm font-semibold" :class="{ 'text-right': reverse }">
        {{ wallet.name }}
      </div>
      <div
        class="flex h-full flex-row items-center gap-1 text-xs"
        :class="{ 'flex-row-reverse': reverse }"
      >
        <!-- <small class="align-middle font-normal">{{ checksum?.TextPart }}</small> -->
        <small class="rounded bg-foreground/10 px-1 font-normal uppercase text-foreground">{{
          walletTypeToString(wallet.type)
        }}</small>
        <venetian-mask-icon v-if="wallet.settings.avoidAddressReuse" class="h-4 w-4" />
        <loading-indicator v-if="loading" class="h-4 w-4" />
      </div>
    </div>

    <canvas
      :id="canvasId"
      class="inline-block h-9 w-9 rounded ring-1 ring-foreground/10 ring-offset-1"
    ></canvas>
  </div>
</template>
