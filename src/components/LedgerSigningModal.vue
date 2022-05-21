<template>
  <o-modal
    :active="active"
    :auto-focus="true"
    :can-cancel="closable"
    @onClose="emitOnClose()"
    scroll="clip"
    content-class="!w-auto rounded min-h-50"
  >
    <div class="h-max mb-5 text-gray-600">
      <ledger-device
        :bottom-text="state.statusText"
        :state="state.state"
        :loading="state.loading"
        :connected="state.connected"
        :app-id="state.appId"
        :screen-text="state.screenText"
      />
    </div>
  </o-modal>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import LoadingIndicator from "@/components/LoadingIndicator.vue";
import { LedgerState } from "@/constants/ledger";

export default defineComponent({
  name: "ConnectLedgerView",
  components: { LoadingIndicator },
  props: {
    state: { type: Object, required: true }
  },
  computed: {
    active(): boolean {
      return this.state.state !== LedgerState.unknown;
    },
    closable(): boolean {
      return ["error", "success", "deviceNotFound"].includes(this.state.state);
    }
  },
  methods: {
    emitOnClose(): void {
      this.$emit("close");
    }
  }
});
</script>
