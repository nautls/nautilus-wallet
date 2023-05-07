<template>
  <tx-box-details v-if="tx.totalIncoming.length > 0" :assets="tx.totalIncoming" :type="'success'">
    <p>Assets <strong>incoming</strong> to your wallet</p>
  </tx-box-details>
  <tx-box-details v-if="tx.totalLeaving.length > 0" :assets="tx.totalLeaving" :type="'warning'">
    <p>Assets <strong>leaving</strong> your wallet</p>
  </tx-box-details>
</template>

<script lang="ts">
import { defineComponent, PropType } from "vue";
import TxBoxDetails from "@/components/TxBoxDetails.vue";
import { TxInterpreter } from "@/api/ergo/transaction/interpreter/txInterpreter";

export default defineComponent({
  name: "TxSignSummary",
  components: { TxBoxDetails },
  props: {
    tx: { type: Object as PropType<Readonly<TxInterpreter>>, required: true }
  }
});
</script>
