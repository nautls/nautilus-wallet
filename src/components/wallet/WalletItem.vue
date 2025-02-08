<script setup lang="ts">
import { HTMLAttributes, nextTick, ref, useId, watch } from "vue";
import { renderIcon } from "@download/blockies";
import { calcCip4ImageHash } from "@/chains/ergo/checksum";
import { mountExtendedPublicKey } from "@/common/serializer";
import { cn } from "@/common/utils";
import { IDbWallet } from "@/types/database";
import { WalletType } from "@/types/internal";

const COLORS = [
  ["#17d1aa", "#e1f2ff", "#a80b32"],
  ["#fa5380", "#e1f2ff", "#0833b2"],
  ["#f06ef5", "#e1f2ff", "#0804f7"],
  ["#ebb687", "#e1f2ff", "#852d62"],
  ["#f59f9a", "#e1f2ff", "#085f48"]
];

const props = defineProps<{
  wallet: IDbWallet;
  concise?: boolean;
  class?: HTMLAttributes["class"];
}>();

const id = useId();
const checksum = ref("");
const canvasId = ref(`wlt-${id}-checksum`);

function getFirstByte(hex: string): number {
  return Number.parseInt(hex.substring(0, 2), 16);
}

watch(
  () => props.wallet,
  () => {
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
  },
  {
    immediate: true,
    deep: false
  }
);

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
  <div :class="cn('flex w-full h-auto flex-row gap-2 items-center text-left', props.class)">
    <canvas
      :id="canvasId"
      :class="concise ? 'h-6 rounded-sm' : 'h-7 rounded-md'"
      class="inline-block w-auto ring-1 ring-foreground/10 ring-offset-1"
    ></canvas>

    <div class="flex w-full gap-0 flex-col whitespace-nowrap justify-between">
      <div
        class="w-full truncate text-sm leading-tight max-w-[110px]"
        :class="concise ? 'font-normal max-w-[125px]' : 'font-semibold max-w-[110px]'"
      >
        {{ wallet.name }}
      </div>

      <div class="text-muted-foreground leading-tight text-xs">
        {{ walletTypeToString(wallet.type) }}
      </div>
    </div>
  </div>
</template>
