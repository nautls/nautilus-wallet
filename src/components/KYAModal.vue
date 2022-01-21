<template>
  <div>
    <o-modal
      :active="active"
      :auto-focus="true"
      :can-cancel="false"
      @onClose="emitOnClose()"
      scroll="clip"
      content-class="!w-11/12 rounded max-h-10/12"
    >
      <div class="p-4 text-xs flex flex-col gap-4 tracking-normal">
        <h1 class="font-bold text-lg">Know Your Assumptions</h1>
        <p>Nautilus is an open source tool for interacting with the Ergo Blockchain.</p>
        <div>
          <span class="font-bold">Notice that:</span>
          <ul class="list-inside indent-xs">
            <li>- We don't log, collect, profile, share or sell your data;</li>
            <li>
              - Nautilus operates on a live blockchain, thus transactions are final, and
              irreversible once they have status «<span class="font-semibold">confirmed</span>»;
            </li>
            <li>
              - Every transaction can be viewed via
              <a href="https://explorer.ergoplatform.com" target="_blank" class="url">explorer</a>;
            </li>
            <li>
              -
              <a href="https://github.com/capt-nemo429/nautilus-wallet" target="_blank" class="url"
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
          <ul class="list-decimal list-inside indent-xs">
            <li>You will use the product at your own peril and risk;</li>
            <li>Only YOU are responsible for your assets;</li>
            <li>Only YOU are responsible for securely storing your recovery phrase.</li>
          </ul>
        </div>

        <button @click="accept()" class="btn !p-2 mt-6">I understand and accept the KYA</button>
      </div>
    </o-modal>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { ACTIONS } from "@/constants/store/actions";
import { mapActions } from "vuex";

export default defineComponent({
  name: "KYAModal",
  props: {
    active: { type: Boolean, required: true }
  },
  methods: {
    emitOnClose(): void {
      this.$emit("close");
    },
    ...mapActions({ saveSettings: ACTIONS.SAVE_SETTINGS }),
    accept(): void {
      this.saveSettings({ isKyaAccepted: true });
    }
  }
});
</script>
