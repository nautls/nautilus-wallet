<template>
  <o-modal
    :active="active"
    :auto-focus="false"
    :can-cancel="true"
    @onClose="emitOnClose()"
    scroll="clip"
    content-class="!max-w-11/12 rounded !w-110 max-h-11/12"
  >
    <div class="p-4 text-xs flex flex-col gap-4 tracking-normal">
      <h1 class="font-bold text-lg">Extended Public Key</h1>
      <p>
        Extended Public Keys allow seeing your transactions history and create new addresses, but
        does not allow to spend or move the funds in any way.
      </p>
      <div class="text-center">
        <canvas class="inline-block w-70 h-70 rounded" id="xpk-canvas"></canvas>
      </div>
      <div class="rounded font-mono bg-gray-100 text-sm p-2 break-all border-gray-200 border">
        {{ $store.state.currentWallet.extendedPublicKey }}
        <click-to-copy :content="$store.state.currentWallet.extendedPublicKey" size="12" />
      </div>
      <button @click="accept()" class="btn !p-2 mt-2">Done</button>
    </div>
  </o-modal>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { ACTIONS } from "@/constants/store/actions";
import { mapActions } from "vuex";
import QRCode from "qrcode";

export default defineComponent({
  name: "KYAModal",
  props: {
    active: { type: Boolean, required: true }
  },
  watch: {
    active() {
      if (!this.active) {
        return;
      }

      const xpk = this.$store.state.currentWallet.extendedPublicKey;

      this.$nextTick(() => {
        QRCode.toCanvas(document.getElementById("xpk-canvas"), xpk, {
          errorCorrectionLevel: "low",
          margin: 0,
          scale: 4
        });
      });
    }
  },
  methods: {
    emitOnClose(): void {
      this.$emit("close");
    },
    ...mapActions({ saveSettings: ACTIONS.SAVE_SETTINGS }),
    accept(): void {
      this.emitOnClose();
    }
  }
});
</script>
