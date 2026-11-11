<script setup lang="ts">
import { HTMLAttributes } from "vue";
import { CreditCardIcon } from "@lucide/vue";
import { useI18n } from "vue-i18n";
import { Button, ButtonVariants } from "@/components/ui/button";

interface Props {
  variant?: ButtonVariants["variant"];
  size?: ButtonVariants["size"];
  class?: HTMLAttributes["class"];
}

const props = withDefaults(defineProps<Props>(), {
  variant: "outline"
});

const { t } = useI18n({ useScope: "global" });

function navigateToBanxa() {
  window.open("https://checkout.banxa.com/?coinType=ERG", "_blank");
}
</script>

<template>
  <Button v-bind="props" @click="navigateToBanxa">
    <CreditCardIcon />{{ t("common.buyErg") }}</Button
  >
</template>
