<template>
  <o-modal
    :active="active"
    :auto-focus="true"
    :can-cancel="false"
    content-class="!w-11/12 rounded max-h-10/12"
    scroll="clip"
    @on-close="emitOnClose()"
  >
    <div class="flex flex-col gap-4 p-4 text-xs tracking-normal">
      <h1 class="text-lg font-bold">Know Your Assumptions</h1>
      <p>Nautilus is an open source tool for interacting with the Ergo Blockchain.</p>
      <div>
        <span class="font-bold">Notice that:</span>
        <ul class="indent-xs list-inside">
          <li>- We don't log, collect, profile, share or sell your data;</li>
          <li>
            - Nautilus operates on a live blockchain, thus transactions are final, and irreversible
            once they have status «<span class="font-semibold">confirmed</span>»;
          </li>
          <li>
            - Every transaction can be viewed via
            <a href="https://sigmaspace.io" target="_blank" class="url">explorer</a>;
          </li>
          <li>
            -
            <a href="https://github.com/nautls/nautilus-wallet" target="_blank" class="url"
              >All code is open source and available</a
            >
            for public review.
          </li>
        </ul>
      </div>
      <p class="font-bold">Nautilus Team doesn't guarantee the absence of bugs and errors.</p>
      <p class="font-bold">
        NO assistance can offered if a user is hacked or cheated out of passwords, currency or
        private keys.
      </p>
      <p class="font-bold">
        This is a BETA version, we recommend that you DO NOT use it to make large transactions!
      </p>
      <div>
        <span class="font-bold">By accepting these KYA, you agree that: </span>
        <ul class="indent-xs list-inside list-decimal">
          <li>You will use the product at your own peril and risk;</li>
          <li>Only YOU are responsible for your assets;</li>
          <li>Only YOU are responsible for securely storing your recovery phrase.</li>
        </ul>
      </div>

      <button class="btn mt-6 !p-2" @click="accept()">I understand and accept the KYA</button>
    </div>
  </o-modal>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { useAppStore } from "@/stores/appStore";

export default defineComponent({
  name: "KYAModal",
  props: {
    active: { type: Boolean, required: true }
  },
  setup() {
    return { app: useAppStore() };
  },
  methods: {
    emitOnClose(): void {
      this.$emit("close");
    },
    accept(): void {
      this.app.settings.isKyaAccepted = true;
    }
  }
});
</script>
