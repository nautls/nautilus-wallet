<template>
  <o-modal
    :active="active"
    :auto-focus="false"
    :can-cancel="true"
    scroll="clip"
    content-class="!max-w-96 rounded !w-110 max-h-[90vh]"
    @on-close="emitOnClose()"
  >
    <div class="flex flex-col gap-4 p-4 text-xs tracking-normal">
      <h1 class="text-lg font-bold">Extended Public Key</h1>
      <p>
        Extended Public Keys allow seeing your transactions history and create new addresses, but
        does not allow to spend or move the funds in any way.
      </p>
      <div class="text-center">
        <qr-code :data="extendedPublicKey" class="w-70 h-70 inline-block rounded" />
      </div>
      <div class="break-all rounded border border-gray-200 bg-gray-100 p-2 font-mono text-sm">
        {{ extendedPublicKey }}
        <click-to-copy :content="extendedPublicKey" />
      </div>
      <button class="btn mt-2 !p-2" @click="accept()">Done</button>
    </div>
  </o-modal>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { mountExtendedPublicKey } from "@/common/serializer";
import { useWalletStore } from "@/stores/walletStore";
import { useQrCode } from "@/composables";

export default defineComponent({
  name: "KYAModal",
  components: { qrCode: useQrCode({ border: 0 }) },
  props: {
    active: { type: Boolean, required: true }
  },
  setup() {
    return { wallet: useWalletStore() };
  },
  computed: {
    extendedPublicKey() {
      return mountExtendedPublicKey(this.wallet.publicKey, this.wallet.chainCode);
    }
  },
  methods: {
    emitOnClose(): void {
      this.$emit("close");
    },
    accept(): void {
      this.emitOnClose();
    }
  }
});
</script>
