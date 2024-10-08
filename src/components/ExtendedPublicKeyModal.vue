<template>
  <o-modal
    :active="active"
    :auto-focus="false"
    :can-cancel="true"
    scroll="clip"
    content-class="!max-w-11/12 rounded !w-110 max-h-11/12"
    @on-close="emitOnClose()"
  >
    <div class="p-4 text-xs flex flex-col gap-4 tracking-normal">
      <h1 class="font-bold text-lg">Extended Public Key</h1>
      <p>
        Extended Public Keys allow seeing your transactions history and create new addresses, but
        does not allow to spend or move the funds in any way.
      </p>
      <div class="text-center">
        <qr-code :data="extendedPublicKey" class="inline-block w-70 h-70 rounded" />
      </div>
      <div class="rounded font-mono bg-gray-100 text-sm p-2 break-all border-gray-200 border">
        {{ extendedPublicKey }}
        <click-to-copy :content="extendedPublicKey" size="12" />
      </div>
      <button class="btn !p-2 mt-2" @click="accept()">Done</button>
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
