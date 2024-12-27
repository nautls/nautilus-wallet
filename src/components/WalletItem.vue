<script setup lang="ts">
import { nextTick, onMounted, PropType, ref, useId } from "vue";
import { renderIcon } from "@download/blockies";
import { calcCip4ImageHash } from "@/chains/ergo/checksum";
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
  concise: { type: Boolean, default: false }
});

const id = useId();

const checksum = ref("");
const canvasId = ref(`wlt-${props.wallet.id}-${id}-checksum`);

function getFirstByte(hex: string): number {
  return Number.parseInt(hex.substring(0, 2), 16);
}

onMounted(() => {
  const xpk = mountExtendedPublicKey(props.wallet.publicKey, props.wallet.chainCode);
  checksum.value = calcCip4ImageHash(xpk);

  const i = getFirstByte(checksum.value) % COLORS.length;
  const [primary, background, spot] = COLORS[i];

  nextTick(() => {
    renderIcon(
      {
        seed: checksum.value,
        size: 7,
        scale: 4,
        color: primary,
        bgcolor: background,
        spotcolor: spot
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
  <div class="flex w-full h-auto flex-row gap-2 items-center text-left">
    <canvas
      :id="canvasId"
      :class="concise ? 'h-5 rounded-sm' : 'h-auto rounded-md'"
      class="inline-block w-auto ring-1 ring-foreground/10 ring-offset-1"
    ></canvas>

    <div class="flex w-full gap-0 flex-col whitespace-nowrap justify-center">
      <p
        class="w-full truncate text-sm leading-tight"
        :class="concise ? 'font-normal' : 'font-semibold'"
      >
        {{ wallet.name }}
      </p>

      <small class="text-muted-foreground leading-tight">
        {{ walletTypeToString(wallet.type) }}
      </small>
      <!-- <div v-else class="flex flex-row gap-1 text-xs">
        <small class="rounded bg-foreground/10 px-1 font-normal uppercase text-foreground">{{
          walletTypeToString(wallet.type)
        }}</small>
        <venetian-mask-icon v-if="wallet.settings.avoidAddressReuse" class="h-4 w-4" />
        <loading-indicator v-if="loading" class="h-4 w-4" />
      </div> -->
    </div>
  </div>
</template>
