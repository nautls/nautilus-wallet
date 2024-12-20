<script setup lang="ts" generic="T extends Record<string, any>">
import { type BulletLegendItemInterface, CurveType } from "@unovis/ts";
import { Area, Line } from "@unovis/ts";
import { VisArea, VisLine, VisXYContainer } from "@unovis/vue";
import { useMounted } from "@vueuse/core";
import { useId } from "radix-vue";
import { type Component, computed, ref } from "vue";
import type { BaseChartProps } from ".";
import { ChartCrosshair, defaultColors } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

const props = withDefaults(
  defineProps<
    BaseChartProps<T> & {
      /**
       * Render custom tooltip component.
       */
      customTooltip?: Component;
      /**
       * Type of curve
       */
      curveType?: CurveType;
      /**
       * Controls the visibility of gradient.
       * @default true
       */
      showGradiant?: boolean;
    }
  >(),
  {
    curveType: CurveType.MonotoneX,
    filterOpacity: 0.2,
    margin: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    showTooltip: true,
    showGradiant: true
  }
);

defineEmits<{
  legendItemClick: [d: BulletLegendItemInterface, i: number];
}>();

type KeyOfT = Extract<keyof T, string>;
type Data = (typeof props.data)[number];

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
  props.categories.map((category, i) => ({
    name: category,
    color: colors.value[i],
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
            v-for="(color, i) in colors"
            :id="`${chartRef}-color-${i}`"
            :key="i"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <template v-if="showGradiant">
              <stop offset="5%" :stop-color="color" stop-opacity="0.4" />
              <stop offset="95%" :stop-color="color" stop-opacity="0" />
            </template>
            <template v-else>
              <stop offset="0%" :stop-color="'hsl(var(--background))'" />
            </template>
          </linearGradient>
        </defs>
      </svg>

      <ChartCrosshair
        v-if="showTooltip"
        :colors="colors"
        :items="legendItems"
        :index="index"
        :custom-tooltip="customTooltip"
      />

      <template v-for="(category, i) in categories" :key="category">
        <VisArea
          :x="(d: Data, i: number) => i"
          :y="(d: Data) => d[category]"
          color="auto"
          :curve-type="curveType"
          :attributes="{
            [Area.selectors.area]: {
              fill: `url(#${chartRef}-color-${i})`
            }
          }"
          :opacity="
            legendItems.find((item) => item.name === category)?.inactive ? filterOpacity : 1
          "
        />
      </template>

      <template v-for="(category, i) in categories" :key="category">
        <VisLine
          :x="(d: Data, i: number) => i"
          :y="(d: Data) => d[category]"
          :color="colors[i]"
          :curve-type="curveType"
          :attributes="{
            [Line.selectors.line]: {
              opacity: legendItems.find((item) => item.name === category)?.inactive
                ? filterOpacity
                : 1
            }
          }"
        />
      </template>

      <slot />
    </VisXYContainer>
  </div>
</template>
