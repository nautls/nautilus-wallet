<script setup lang="ts">
import { ref, watch } from "vue";
import { QrCodeGenerateData, QrCodeGenerateOptions, renderSVG } from "uqr";

type QrCodeProps = {
  data: QrCodeGenerateData;
  options?: QrCodeGenerateOptions;
};

const props = defineProps<QrCodeProps>();
const svg = ref("");

watch(() => props.data, render, { immediate: true });

function render() {
  if (!props.data) return;
  svg.value = renderSVG(props.data, { border: 0 });
}
</script>

<!-- prettier-ignore -->
<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div class="h-auto grow border border-input rounded-lg object-fill p-1 bg-white [&_svg]:rounded-sm" v-html="svg"></div>
</template>
