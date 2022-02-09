<template>
  <div class="flex flex-col gap-5 h-full">
    <page-title title="Settings" />

    <label>
      Wallet name
      <input
        @blur="v$.walletName.$touch()"
        v-model.lazy="walletName"
        type="text"
        spellcheck="false"
        class="w-full control block"
      />
      <p class="input-error" v-if="v$.walletName.$error">{{ v$.walletName.$errors[0].$message }}</p>
    </label>
    <div class="flex-grow flex flex-col gap-5">
      <div>
        <label class="w-full cursor-pointer align-middle flex flex-row items-center gap-5">
          <div class="flex-grow">
            <p>Avoid address reuse</p>
          </div>
          <div><o-switch v-model="avoidAddressReuse" class="align-middle float-right" /></div>
        </label>
        <div class="text-gray-500 text-xs font-normal mt-1">
          <p>
            Turn off this feature to use the same address multiple times, useful for NFTs, and Defi,
            but it makes tracking and linking actors on blockchains a simpler task.
          </p>
          <p class="mt-1">Create a homebase or roam free.</p>
        </div>
      </div>
      <div>
        <label class="w-full cursor-pointer align-middle flex flex-row items-center gap-5">
          <div class="flex-grow">
            <p>Hide used addresses</p>
          </div>
          <div><o-switch v-model="hideUsedAddresses" class="align-middle float-right" /></div>
        </label>
        <div class="text-gray-500 text-xs font-normal mt-1">
          <p>Hide empty used addresses from Receive page.</p>
        </div>
      </div>
    </div>

    <div class="flex flex-row gap-4">
      <button class="btn outlined w-full" @click="$router.back()">Cancel</button>
      <button class="btn w-full" @click="update()">Save</button>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { helpers, required } from "@vuelidate/validators";
import { useVuelidate } from "@vuelidate/core";
import { mapActions, mapState } from "vuex";
import { StateWallet, UpdateWalletSettingsCommand } from "@/types/internal";
import { ACTIONS } from "@/constants/store";

export default defineComponent({
  name: "SettingsView",
  setup() {
    return { v$: useVuelidate() };
  },
  computed: {
    ...mapState({
      currentWallet: "currentWallet"
    })
  },
  watch: {
    ["currentWallet"]: {
      immediate: true,
      deep: true,
      handler(newVal: StateWallet) {
        if (newVal.name !== this.walletName) {
          this.walletName = newVal.name;
        }

        if (newVal.settings.avoidAddressReuse != this.avoidAddressReuse) {
          this.avoidAddressReuse = newVal.settings.avoidAddressReuse;
        }

        if (newVal.settings.hideUsedAddresses != this.hideUsedAddresses) {
          this.hideUsedAddresses = newVal.settings.hideUsedAddresses;
        }
      }
    }
  },
  data() {
    return {
      walletName: "",
      avoidAddressReuse: false,
      hideUsedAddresses: true
    };
  },
  validations() {
    return {
      walletName: { required: helpers.withMessage("Wallet name is required.", required) }
    };
  },
  methods: {
    ...mapActions({ updateWalletSettings: ACTIONS.UPDATE_WALLET_SETTINGS }),
    async update() {
      const isValid = await this.v$.$validate();
      if (!isValid) {
        return;
      }

      const command = {
        walletId: this.currentWallet.id,
        name: this.walletName,
        settings: {
          avoidAddressReuse: this.avoidAddressReuse,
          hideUsedAddresses: this.hideUsedAddresses,
          defaultChangeIndex: this.currentWallet.settings.defaultChangeIndex
        }
      } as UpdateWalletSettingsCommand;

      await this.updateWalletSettings(command);
      this.$router.back();
    }
  }
});
</script>
