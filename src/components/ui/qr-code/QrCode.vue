<script setup lang="ts">
import { ref, watch } from "vue";
import { encode, QrCodeDataType, QrCodeGenerateData, QrCodeGenerateOptions } from "uqr";

type QrCodeProps = {
  data: QrCodeGenerateData;
  options?: QrCodeGenerateOptions;
};

const props = defineProps<QrCodeProps>();
const svg = ref("");

watch(() => props.data, render, { immediate: true });

function render() {
  if (!props.data) return;

  const { size, data, types } = encode(props.data, { border: 0, ...props.options });
  let dots = "";

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // finder patterns are drawn separately below
      if (!data[y][x] || types[y][x] === QrCodeDataType.Position) continue;
      dots += `<circle cx="${x + 0.5}" cy="${y + 0.5}" r="0.45"/>`;
    }
  }

  const eyes = [
    [0, 0],
    [size - 7, 0],
    [0, size - 7]
  ]
    .map(
      ([x, y]) =>
        `<rect x="${x + 0.5}" y="${y + 0.5}" width="6" height="6" rx="2" fill="none" stroke="currentColor" stroke-width="1"/>` +
        `<rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="1"/>`
    )
    .join("");

  svg.value = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" fill="currentColor">${dots}${eyes}</svg>`;
}
</script>

<!-- prettier-ignore -->
<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div class="h-auto grow border border-input rounded-lg object-fill p-1 bg-white text-black [&_svg]:rounded-sm" v-html="svg"></div>
</template>
