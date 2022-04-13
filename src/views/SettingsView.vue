<template>
  <div class="flex flex-col gap-5">
    <div class="text-xs text-gray-500 border-b-gray-300 border-b-1 uppercase">Wallet settings</div>
    <label>
      Wallet name
      <input
        @blur="(v$.walletSettings as any).name.$touch()"
        v-model.lazy="walletSettings.name"
        type="text"
        spellcheck="false"
        class="w-full control block"
      />
      <p class="input-error" v-if="(v$.walletSettings as any).name.$error">
        {{ (v$.walletSettings as any).name.$errors[0].$message }}
      </p>
    </label>
    <div>
      <label class="w-full cursor-pointer align-middle flex flex-row items-center gap-5">
        <div class="flex-grow">
          <p>Privacy mode</p>
        </div>
        <div>
          <o-switch v-model="walletSettings.avoidAddressReuse" class="align-middle float-right" />
        </div>
      </label>
      <div class="text-gray-500 text-xs font-normal mt-1">
        <p>
          This option enables address reuse avoidance. Address reuse creates a common point of use.
          It makes tracking and linking actors on blockchains a simpler task. Avoiding address reuse
          makes tracking more difficult as each user never goes back to a previously used address.
        </p>
        <p class="mt-1">Create a home base, or roam free. This is up to you.</p>
      </div>
    </div>
    <div>
      <label class="w-full cursor-pointer align-middle flex flex-row items-center gap-5">
        <div class="flex-grow">
          <p>Hide used addresses</p>
        </div>
        <div>
          <o-switch v-model="walletSettings.hideUsedAddresses" class="align-middle float-right" />
        </div>
      </label>
      <div class="text-gray-500 text-xs font-normal mt-1">
        <p>Hide empty used addresses from Receive page.</p>
      </div>
    </div>
    <div>
      <div class="w-full align-middle flex flex-row items-center gap-5">
        <div class="flex-grow">
          <p class="font-semibold text-sm">Export wallet</p>
        </div>
        <button class="btn outlined !p-2 !py-1.5 !text-xs" @click="xpkModalActive = true">
          Export
        </button>
      </div>
      <div class="text-gray-500 text-xs font-normal mt-1">
        <p>Use this option to export your Extended Public Key.</p>
      </div>
    </div>
    <div class="text-xs text-gray-500 border-b-gray-300 border-b-1 uppercase pt-5">
      Global settings
    </div>
    <div>
      <label class="w-full cursor-pointer align-middle flex flex-row items-center gap-5">
        <div class="flex-grow">
          <p>Currency conversion</p>
        </div>
        <div class="w-3/12">
          <div class="relative inline-block w-full">
            <select
              v-model="globalSettings.conversionCurrency"
              :disabled="loading"
              class="w-full !py-1 appearance-none control cursor-pointer"
            >
              <option v-for="currency in currencies" :value="currency">
                {{ $filters.uppercase(currency) }}
              </option>
            </select>
            <div class="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
              <loading-indicator v-if="loading" type="circle" class="w-4 h-4 mr-1" />
              <vue-feather v-else type="chevron-down" class="w-4 h-4" />
            </div>
          </div>
        </div>
      </label>
    </div>
    <div class="text-xs text-gray-500 border-b-gray-300 border-b-1 uppercase pt-5">Danger zone</div>
    <div>
      <div class="w-full align-middle flex flex-row items-center gap-5">
        <div class="flex-grow">
          <p class="font-semibold text-sm">Remove Wallet</p>
        </div>
        <button class="btn danger !p-2 !py-1.5 !text-xs" @click="remove()">Remove</button>
      </div>
      <div class="text-gray-500 text-xs font-normal mt-1">
        <p>
          Removing a wallet does not affect the wallet balance. Your wallet can be restored again at
          any time. Please double-check you still have the means to restore access to this wallet.
          If you cannot, removing the wallet may result in irreversible loss of funds.
        </p>
      </div>
    </div>
    <extended-public-key-modal :active="xpkModalActive" @close="xpkModalActive = false" />
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { helpers, required } from "@vuelidate/validators";
import { useVuelidate } from "@vuelidate/core";
import { mapActions, mapState } from "vuex";
import { StateWallet, UpdateWalletSettingsCommand } from "@/types/internal";
import { ACTIONS } from "@/constants/store";
import { coinGeckoService } from "@/api/coinGeckoService";
import ExtendedPublicKeyModal from "@/components/ExtendedPublicKeyModal.vue";

export default defineComponent({
  name: "SettingsView",
  components: { ExtendedPublicKeyModal },
  setup() {
    return { v$: useVuelidate() };
  },
  computed: {
    ...mapState({
      currentWallet: "currentWallet",
      settings: "settings"
    })
  },
  watch: {
    walletSettings: {
      deep: true,
      handler() {
        if (this.walletChanged) {
          this.walletChanged = false;
          return;
        }
        this.updateWallet();
      }
    },
    globalSettings: {
      deep: true,
      handler() {
        if (this.walletChanged) {
          this.walletChanged = false;
          return;
        }
        this.updateGlobal();
      }
    },
    ["currentWallet"]: {
      immediate: true,
      deep: true,
      handler(newVal: StateWallet) {
        this.walletSettings = {
          name: newVal.name,
          ...newVal.settings
        };
        this.walletChanged = true;
      }
    }
  },
  created() {
    this.currencies = [this.settings.conversionCurrency];
    this.globalSettings.conversionCurrency = this.settings.conversionCurrency;
  },
  async mounted() {
    this.currencies = await coinGeckoService.getSupportedCurrencyConversion();
    this.loading = false;
  },
  data() {
    return {
      walletSettings: {
        name: "",
        avoidAddressReuse: false,
        hideUsedAddresses: true
      },
      globalSettings: {
        conversionCurrency: ""
      },
      walletChanged: true,
      loading: true,
      currencies: [] as string[],
      xpkModalActive: false
    };
  },
  validations() {
    return {
      walletSettings: {
        name: {
          required: helpers.withMessage("Wallet name is required.", required)
        }
      }
    };
  },
  methods: {
    ...mapActions({
      updateWalletSettings: ACTIONS.UPDATE_WALLET_SETTINGS,
      saveSettings: ACTIONS.SAVE_SETTINGS,
      fetchPrices: ACTIONS.FETCH_CURRENT_PRICES,
      removeWallet: ACTIONS.REMOVE_WALLET
    }),
    async remove() {
      if (confirm(`Are you sure you want to remove '${this.currentWallet.name}'?`)) {
        this.removeWallet(this.currentWallet.id);
      }
    },
    async updateWallet() {
      const isValid = await this.v$.$validate();
      if (!isValid) {
        return;
      }
      const command = {
        walletId: this.currentWallet.id,
        ...this.walletSettings
      } as UpdateWalletSettingsCommand;
      await this.updateWalletSettings(command);
    },
    async updateGlobal() {
      if (this.settings.conversionCurrency != this.globalSettings.conversionCurrency) {
        await this.saveSettings({ conversionCurrency: this.globalSettings.conversionCurrency });
        this.fetchPrices();
      }
    }
  }
});
</script>
