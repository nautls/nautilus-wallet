<script setup lang="ts">
import { onMounted, toRef } from "vue";
import { UR, UREncoder } from "@keystonehq/keystone-sdk";
import { QrCode } from "@/components/ui/qr-code";

interface Props {
  ur: UR | undefined;
}

const props = defineProps<Props>();

const qrData = toRef("");

onMounted(() => {
  if (props.ur) {
    const urEncoder = new UREncoder(props.ur);
    setInterval(() => {
      qrData.value = urEncoder.nextPart();
    }, 500);
  }
});
</script>

<template>
  <qr-code :data="qrData" />
</template>
