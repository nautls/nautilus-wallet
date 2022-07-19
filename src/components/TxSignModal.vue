<template>
  <o-modal
    v-model:active="internalActive"
    :auto-focus="true"
    :can-cancel="true"
    :animation="isPopUp ? 'fade-slide-up' : 'zoom-out'"
    @cancel="emitOnClose"
    scroll="clip"
    root-class="outline-none <sm:justify-end"
    content-class="animation-content max-h-90vh p-4 rounded !max-w-100 !w-90vw <sm:rounded-t-xl <sm:rounded-none <sm:h-90vh !<sm:w-100vw"
  >
    <div class="flex flex-col h-full gap-4">
      <div class="mb-4 text-center">
        <h1 class="font-bold text-lg">Transaction review</h1>
        <p class="text-xs">Please review your transaction before you sign it.</p>
      </div>
      <tx-sign-view
        v-if="transaction"
        :transaction="transaction"
        :is-modal="true"
        @fail="fail"
        @refused="refused"
        @success="success"
      />
    </div>
  </o-modal>
</template>

<script lang="ts">
import { ErgoTx, UnsignedTx } from "@/types/connector";
import { isPopup } from "@/utils/browserApi";
import { defineComponent, PropType } from "vue";
import TxSignView from "./TxSignView.vue";

export default defineComponent({
  name: "TxSignModal",
  components: { TxSignView },
  emits: ["success", "fail", "refused", "close"],
  props: {
    transaction: { type: Object as PropType<Readonly<UnsignedTx>>, required: false },
    active: { type: Boolean, required: true }
  },
  computed: {
    isPopUp(): boolean {
      return isPopup();
    }
  },
  data() {
    return {
      internalActive: false
    };
  },
  watch: {
    active(newVal: boolean) {
      this.internalActive = newVal;
    }
  },
  methods: {
    fail(info: string) {
      this.$emit("fail", info);
      this.close();
    },
    refused(info: string) {
      this.$emit("refused", info);
      this.close();
    },
    success(tx: ErgoTx) {
      this.$emit("success", tx);
      this.close();
    },
    emitOnClose(): void {
      this.$emit("close");
    },
    close(): void {
      this.internalActive = false;
    }
  }
});
</script>
