<template>
  <div>
    <input
      type="text"
      :disabled="loading"
      v-model="filter"
      placeholder="Search"
      class="w-full control block"
    />
  </div>
  <div v-for="option in options" :key="option.yAxis.name">
    <v-chart class="chart" :option="option" />
  </div>
</template>

<script lang="ts">
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { PieChart, LineChart } from "echarts/charts";
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent
} from "echarts/components";
import VChart, { THEME_KEY } from "vue-echarts";
import { ref, defineComponent } from "vue";

import { GETTERS } from "@/constants/store/getters";
import { StateTokenMarketRates } from "@/types/internal";
import { ITokenRate } from "ergo-market-lib/dist/interfaces/ITokenRate";
import moment from "moment";

use([
  CanvasRenderer,
  PieChart,
  LineChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent
]);

export default defineComponent({
  name: "ChartsView",
  components: {
    VChart
  },
  provide: {
    [THEME_KEY]: "light"
  },
  computed: {
    options(): any[] {
      const marketRates: StateTokenMarketRates = this.$store.getters[GETTERS.MARKET_RATES];
      const ratesOverTime = Object.values(marketRates)
        .map(({ ratesOverTime }) => ratesOverTime)
        .filter(([tokenRate]) =>
          tokenRate.token.name.toLocaleLowerCase().includes(this.filter.toLocaleLowerCase())
        );

      return ratesOverTime.map((tokenRates: ITokenRate[]) => ({
        tooltip: {
          trigger: "axis",
          axisPointer: { type: "cross" }
        },
        legend: {},
        xAxis: {
          type: "time",
          data: tokenRates.map(({ timestamp }) => moment(timestamp).toDate()),
          axisTick: {
            alignWithLabel: true
          },
          axisLabel: {
            rotate: 30
          }
        },
        yAxis: {
          type: "value",
          name: `1 ${tokenRates[0].token.name} = ~${(
            this.$store.getters[GETTERS.ERG_PRICE] * tokenRates.slice(-1)[0].ergPerToken
          ).toFixed(2)} USD`,
          position: "right",
          axisLabel: {
            formatter: "{value} USD"
          },
          smooth: true
        },
        series: {
          data: tokenRates.map((rate) => ({
            name: rate.timestamp,
            value: [moment(rate.timestamp).toDate(), rate.ergPerToken]
          })),
          type: "line",
          name: tokenRates[0].token.name,
          showSymbol: false
        }
      }));
    }
  },
  data() {
    return {
      filter: ""
    };
  }
});
</script>

<style scoped>
.chart {
  height: 400px;
}
</style>
