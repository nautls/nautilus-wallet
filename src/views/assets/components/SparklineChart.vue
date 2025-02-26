<script setup lang="ts" generic="T extends Primitive">
import { HTMLAttributes, nextTick, onBeforeUnmount, onMounted, useTemplateRef, watch } from "vue";
import {
  CategoryScale,
  Chart,
  Filler,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip
} from "chart.js";
import { Primitive } from "type-fest";
import { useAppStore } from "@/stores/appStore";
import { bn } from "@/common/bigNumber";
import { cn } from "@/common/utils";
import { useFormat } from "@/composables";

interface Props {
  data: T[];
  labels: T[];
  title?: string;
  class?: HTMLAttributes["class"];
}

Chart.register(
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Filler
);

const props = defineProps<Props>();

const app = useAppStore();
const format = useFormat();

const canvas = useTemplateRef("chart");
let chartInstance: Chart<"line", T[], T> | undefined = undefined;

function getCssVarHsl(variableName: string): string {
  const style = getComputedStyle(document.documentElement);
  return `hsl(${style.getPropertyValue(variableName).trim()})`;
}

onMounted(render);
onBeforeUnmount(() => chartInstance?.destroy());

watch(() => props.data, updateData);
watch(() => app.settings.colorMode, updateColors);

function updateData() {
  if (!chartInstance) {
    render();
    return;
  }

  chartInstance.data.labels = props.labels;
  chartInstance.data.datasets[0].data = props.data;
  chartInstance.update();
}

function updateColors() {
  if (!chartInstance) {
    render();
    return;
  }

  nextTick(() => {
    if (!chartInstance) return;
    chartInstance.data.datasets[0].borderColor = getCssVarHsl("--foreground");
    chartInstance.data.datasets[0].backgroundColor = getCssVarHsl("--background");
    chartInstance.update("none");
  });
}

function render() {
  if (props.data.length <= 1) return;
  if (!canvas.value) return;
  chartInstance?.destroy();

  nextTick(() => {
    chartInstance = new Chart(canvas.value as HTMLCanvasElement, {
      type: "line",
      options: {
        animation: { duration: 500 },
        responsive: true,
        aspectRatio: 3,
        layout: { padding: 0 },
        scales: { x: { display: false }, y: { display: false } },
        plugins: {
          legend: { display: false },
          tooltip: {
            displayColors: false,
            bodyAlign: "center",
            callbacks: {
              label: (ctx) =>
                format.currency.amount(bn(ctx.parsed.y ?? 0), app.settings.conversionCurrency, 3),
              title: props.title ? () => props.title : undefined
            }
          }
        }
      },
      data: {
        labels: props.labels,
        datasets: [
          {
            data: props.data,
            fill: true,
            pointRadius: 0,
            borderWidth: 2,
            pointHitRadius: 5,
            borderColor: getCssVarHsl("--foreground"),
            backgroundColor: getCssVarHsl("--background"),
            tension: 0.2
          }
        ]
      }
    });
  });
}
</script>

<template>
  <canvas id="chart" ref="chart" :class="cn('-m-0.5 size-full', props.class)" />
</template>
