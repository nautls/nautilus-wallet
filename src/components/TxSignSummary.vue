<template>
  <tx-box-details v-if="tx?.burning" :assets="tx?.burning" type="danger">
    <p>Burning</p>
    <template #subheader
      ><span>
        The assets listed below will be lost. Only continue if you know exactly what are you doing.
      </span></template
    >
  </tx-box-details>

  <tx-box-details v-if="tx.totalIncoming.length > 0" :assets="tx.totalIncoming" type="info">
    <p>Total assets <strong>incoming</strong> to your wallet</p>
  </tx-box-details>
  <tx-box-details v-if="tx.totalLeaving.length > 0" :assets="tx.totalLeaving" type="default">
    <p>Total assets <strong>leaving</strong> your wallet</p>
  </tx-box-details>
</template>

<script lang="ts">
import { defineComponent, PropType } from "vue";
import TxBoxDetails from "@/components/TxBoxDetails.vue";
import { TxInterpreter } from "@/chains/ergo/transaction/interpreter/txInterpreter";

export default defineComponent({
  name: "TxSignSummary",
  components: { TxBoxDetails },
  props: {
    tx: { type: Object as PropType<Readonly<TxInterpreter>>, required: true }
  }
});
</script>
@/chains/ergo/transaction/interpreter/txInterpreter
