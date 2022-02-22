<template>
  <div class="flex flex-col gap-5 h-full">
    <div class="text-xs text-gray-500 border-b-gray-300 border-b-1 uppercase">Wallet settings</div>
    <div class="flex-grow flex flex-col gap-5">
      <label>
        Wallet name
        <input
          @blur="v$.walletName.$touch()"
          v-model.lazy="walletName"
          type="text"
          spellcheck="false"
          class="w-full control block"
        />
        <p class="input-error" v-if="v$.walletName.$error">
          {{ v$.walletName.$errors[0].$message }}
        </p>
      </label>
      <div>
        <label class="w-full cursor-pointer align-middle flex flex-row items-center gap-5">
          <div class="flex-grow">
            <p>Privacy mode</p>
          </div>
          <div><o-switch v-model="avoidAddressReuse" class="align-middle float-right" /></div>
        </label>
        <div class="text-gray-500 text-xs font-normal mt-1">
          <p>
            This option enables address reuse avoidance. Address reuse creates a common point of
            use. It makes tracking and linking actors on blockchains a simpler task. Avoiding
            address reuse makes tracking more difficult as each user never goes back to a previously
            used address.
          </p>
          <p class="mt-1">Create a home base, or roam free. This is up to you.</p>
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
                v-model="conversionCurr"
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
import { coinGeckoService } from "@/api/coinGeckoService";
import LoadingIndicator from "@/components/LoadingIndicator.vue";

export default defineComponent({
  name: "SettingsView",
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
    ["currentWallet"]: {
      immediate: true,
      deep: true,
      handler(newVal: StateWallet) {
        this.walletName = newVal.name;
        this.avoidAddressReuse = newVal.settings.avoidAddressReuse;
        this.hideUsedAddresses = newVal.settings.hideUsedAddresses;
      }
    }
  },
  created() {
    this.currencies = [this.settings.conversionCurrency];
    this.conversionCurr = this.settings.conversionCurrency;
  },
  async mounted() {
    this.currencies = await coinGeckoService.getSupportedCurrencyConversion();
    this.loading = false;
  },
  data() {
    return {
      walletName: "",
      avoidAddressReuse: false,
      hideUsedAddresses: true,
      conversionCurr: "",
      loading: true,
      currencies: [] as string[]
    };
  },
  validations() {
    return {
      walletName: { required: helpers.withMessage("Wallet name is required.", required) }
    };
  },
  methods: {
    ...mapActions({
      updateWalletSettings: ACTIONS.UPDATE_WALLET_SETTINGS,
      saveSettings: ACTIONS.SAVE_SETTINGS,
      fetchPrices: ACTIONS.FETCH_CURRENT_PRICES
    }),
    async update() {
      const isValid = await this.v$.$validate();
      if (!isValid) {
        return;
      }

      if (this.settings.conversionCurrency != this.conversionCurr) {
        await this.saveSettings({ conversionCurrency: this.conversionCurr });
        this.fetchPrices();
      }

      const command = {
        walletId: this.currentWallet.id,
        name: this.walletName,
        avoidAddressReuse: this.avoidAddressReuse,
        hideUsedAddresses: this.hideUsedAddresses
      } as UpdateWalletSettingsCommand;
      await this.updateWalletSettings(command);
      this.$router.back();
    }
  },
  components: { LoadingIndicator }
});
</script>
