<script setup lang="ts" generic="T extends Record<string, any>">
import { type BulletLegendItemInterface, CurveType } from "@unovis/ts";
import { Area } from "@unovis/ts";
import { VisArea, VisLine, VisXYContainer } from "@unovis/vue";
import { useMounted } from "@vueuse/core";
import { useId } from "radix-vue";
import { computed, ref } from "vue";
import ChartTooltip from "./SparklineTooltip.vue";
import { ChartCrosshair, defaultColors } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

type KeyOf<T extends Record<string, unknown>> = Extract<keyof T, string>;

const props = withDefaults(
  defineProps<{
    data: T[];
    index: KeyOf<T>;
    categories: KeyOf<T>[];
    colors?: string[];
  }>(),
  {
    margin: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    showTooltip: true,
    colors: undefined
  }
);

type KeyOfT = Extract<keyof T, string>;
type Data = (typeof props.data)[number];

const curveType = CurveType.MonotoneX;
const chartRef = useId();

const index = computed(() => props.index as KeyOfT);

const colors = computed(() =>
  props.colors?.length ? props.colors : defaultColors(props.categories.length)
);

const yDomain = computed(() => {
  const values = props.data.map((d) => props.categories.map((c) => d[c])).flat();
  return [Math.min(...values), Math.max(...values)];
});

const legendItems = ref<BulletLegendItemInterface[]>(
  props.categories.map((category) => ({
    name: category,
    inactive: false
  }))
);

const isMounted = useMounted();
</script>

<template>
  <div :class="cn('flex w-full flex-col items-end', $attrs.class ?? '')">
    <VisXYContainer
      :y-domain="yDomain"
      :scale-by-domain="true"
      :style="{ height: isMounted ? '100%' : 'auto' }"
      :data="data"
    >
      <svg width="0" height="0">
        <defs>
          <linearGradient
            v-for="(_, i) in colors"
            :id="`${chartRef}-color-${i}`"
            :key="i"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" :stop-color="'hsl(var(--background))'" />
          </linearGradient>
        </defs>
      </svg>

      <ChartCrosshair
        :colors="colors"
        :items="legendItems"
        :index="index"
        :custom-tooltip="ChartTooltip"
      />

      <template v-for="(category, i) in categories" :key="category">
        <VisArea
          :x="(_: Data, i: number) => i"
          :y="(d: Data) => d[category]"
          color="auto"
          :curve-type="curveType"
          :attributes="{
            [Area.selectors.area]: {
              fill: `url(#${chartRef}-color-${i})`
            }
          }"
        />
      </template>

      <template v-for="(category, i) in categories" :key="category">
        <VisLine
          :x="(_: Data, i: number) => i"
          :y="(d: Data) => d[category]"
          :color="colors[i]"
          :curve-type="curveType"
        />
      </template>

      <slot />
    </VisXYContainer>
  </div>
</template>
