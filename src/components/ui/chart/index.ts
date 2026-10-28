export { default as ChartCrosshair } from './ChartCrosshair.vue'
export { default as ChartLegend } from './ChartLegend.vue'
export { default as ChartSingleTooltip } from './ChartSingleTooltip.vue'
export { default as ChartTooltip } from './ChartTooltip.vue'

export function defaultColors(count: number = 3) {
  const quotient = Math.floor(count / 2)
  const remainder = count % 2

  const primaryCount = quotient + remainder
  const secondaryCount = quotient
  return [
    ...Array.from(new Array(primaryCount).keys()).map(i => `color-mix(in oklab, var(--vis-primary-color) ${(1 - (1 / primaryCount) * i) * 100}%, transparent)`),
    ...Array.from(new Array(secondaryCount).keys()).map(i => `color-mix(in oklab, var(--vis-secondary-color) ${(1 - (1 / secondaryCount) * i) * 100}%, transparent)`),
  ];
}

export * from './interface'
