<script setup lang="ts">
import { computed, HTMLAttributes, nextTick, ref, useId, watch } from "vue";
import { renderIcon } from "@download/blockies";
import { useI18n } from "vue-i18n";
import { calcCip4ImageHash } from "@/chains/ergo/checksum";
import { mountExtendedPublicKey } from "@/common/serializer";
import { cn } from "@/common/utils";
import { useWalletStore } from "@/stores/walletStore";
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
const { t } = useI18n();
const activeWallet = useWalletStore();

const checksum = ref("");
const canvasId = ref(`wlt-${id}-checksum`);
const displayName = computed(() => {
  const activeDomain =
    props.wallet.id === activeWallet.id ? activeWallet.ergoDomains[0]?.name : undefined;
  return activeDomain ?? props.wallet.ergoDomains?.[0]?.name ?? props.wallet.name;
});

function getFirstByte(hex: string): number {
  return Number.parseInt(hex.substring(0, 2), 16);
}

watch(
  () => props.wallet,
  () => {
    const seed =
      props.wallet.watchAddress ??
      mountExtendedPublicKey(props.wallet.publicKey, props.wallet.chainCode);
    checksum.value = calcCip4ImageHash(seed);

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
      return t("wallet.type.standard");
    case WalletType.ReadOnly:
      return t("wallet.type.readonly");
    case WalletType.Ledger:
      return t("wallet.type.ledger");
    default:
      return "";
  }
}
</script>

<template>
  <div :class="cn('flex h-auto w-full flex-row items-center gap-2 rounded text-left', props.class)">
    <canvas
      :id="canvasId"
      class="ring-foreground/10 inline-block h-full w-auto rounded-sm ring-1 ring-offset-1"
    ></canvas>

    <div class="flex w-full flex-col justify-between whitespace-nowrap">
      <div
        class="w-full max-w-[110px] truncate text-sm leading-tight"
        :class="concise ? 'max-w-[125px] font-normal' : 'font-semibold'"
      >
        {{ displayName }}
      </div>

      <div class="text-muted-foreground text-xs leading-tight">
        {{ walletTypeToString(wallet.type) }}
      </div>
    </div>
  </div>
</template>
