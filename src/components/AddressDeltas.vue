<template>
  <h1>Yeeee</h1>
  <h1>Eoeoeo</h1>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { TxInterpreter } from "@/api/ergo/transaction/interpreter/txInterpreter";
import { type StateAddress } from "@/types/internal";
import BigNumber from "bignumber.js";

export default defineComponent({
  name: "AddressDeltas",
  computed: {
    // deltaPositive(): { [tokenId: string]: BigNumber } {
    //   // TODO implement this and deltaNegative and display them
    // },
  },
  props: {
    tx: { type: TxInterpreter, required: true },
    addresses: { type: Array<StateAddress>, required: false }
  }
});
</script>
