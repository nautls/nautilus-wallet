<script setup lang="ts">
import { HTMLAttributes } from "vue";
import { CreditCardIcon } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import { useWalletStore } from "@/stores/walletStore";
import { Button, ButtonVariants } from "@/components/ui/button";

interface Props {
  variant?: ButtonVariants["variant"];
  size?: ButtonVariants["size"];
  class?: HTMLAttributes["class"];
}

const props = withDefaults(defineProps<Props>(), {
  variant: "outline"
});

const wallet = useWalletStore();
const { t } = useI18n({ useScope: "global" });

function navigateToBanxa() {
  window.open(
    `https://checkout.banxa.com/?coinType=ERG&walletAddress=${wallet.changeAddress.script}`,
    "_blank"
  );
}
</script>

<template>
  <Button v-bind="props" @click="navigateToBanxa">
    <CreditCardIcon />{{ t("common.buyErg") }}</Button
  >
</template>
