<template>
  <div class="flex flex-col gap-5">
    <div class="text-xs text-gray-500 border-b-gray-300 border-b-1 uppercase">Wallet settings</div>
    <label>
      Wallet name
      <input
        v-model.lazy="walletSettings.name"
        type="text"
        spellcheck="false"
        class="w-full control block"
        @blur="(v$.walletSettings as any).name.$touch()"
      />
      <p v-if="(v$.walletSettings as any).name.$error" class="input-error">
        {{ (v$.walletSettings as any).name.$errors[0]?.$message }}
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
    <div class="flex flex-col gap-5">
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
              <option v-for="currency in currencies" :key="currency" :value="currency">
                {{ $filters.string.uppercase(currency) }}
              </option>
            </select>
            <div class="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
              <loading-indicator v-if="loading" type="circular" class="w-4 h-4 mr-1" />
              <vue-feather v-else type="chevron-down" class="w-4 h-4" />
            </div>
          </div>
        </div>
      </label>
      <div>
        <label class="w-full cursor-pointer align-middle flex flex-row items-center gap-5">
          <div class="flex-grow">
            <p>Developer mode</p>
          </div>
          <div>
            <o-switch v-model="globalSettings.devMode" class="align-middle float-right" />
          </div>
        </label>
        <div class="text-gray-500 text-xs font-normal mt-1">
          <p>Enable advanced tools.</p>
        </div>
      </div>
      <label>
        GraphQL server
        <input
          v-model.lazy="globalSettings.graphQLServer"
          type="text"
          spellcheck="false"
          class="w-full control block"
          @blur="(v$.globalSettings as any).graphQLServer.$touch()"
        />
        <p v-if="(v$.globalSettings as any).graphQLServer.$error" class="input-error">
          {{ (v$.globalSettings as any).graphQLServer.$errors[0]?.$message }}
        </p>
      </label>
      <label>
        Explorer URL
        <input
          v-model.lazy="globalSettings.explorerUrl"
          type="text"
          spellcheck="false"
          class="w-full control block"
          @blur="(v$.globalSettings as any).explorerUrl.$touch()"
        />
        <p v-if="(v$.globalSettings as any).explorerUrl.$error" class="input-error">
          {{ (v$.globalSettings as any).explorerUrl.$errors[0]?.$message }}
        </p>
      </label>
    </div>

    <div class="text-xs text-gray-500 border-b-gray-300 border-b-1 uppercase pt-5">
      Token blacklists
    </div>
    <p class="text-gray-500 text-xs font-normal -mt-2">
      Ergo
      <a target="_blank" href="https://github.com/sigmanauts/token-id-blacklist" class="url"
        >tokens blacklists</a
      >
      are maintained by the Sigmanauts community.
    </p>
    <div>
      <label class="w-full cursor-pointer align-middle flex flex-row items-center gap-5">
        <div class="flex-grow">
          <p>Hide NSFW tokens</p>
        </div>
        <div>
          <o-switch v-model="tokensBlacklists.nsfw" class="align-middle float-right" />
        </div>
      </label>

      <label class="w-full cursor-pointer align-middle flex flex-row items-center gap-5 mt-3">
        <div class="flex-grow">
          <p>Hide Scam tokens</p>
        </div>
        <div>
          <o-switch v-model="tokensBlacklists.scam" class="align-middle float-right" />
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
import { defineComponent, Ref } from "vue";
import { helpers, required } from "@vuelidate/validators";
import { useVuelidate, Validation, ValidationArgs } from "@vuelidate/core";
import { clone, isEqual } from "lodash-es";
import { isEmpty } from "@fleet-sdk/common";
import { coinGeckoService } from "@/chains/ergo/services/coinGeckoService";
import ExtendedPublicKeyModal from "@/components/ExtendedPublicKeyModal.vue";
import { MAINNET } from "@/constants/ergo";
import {
  getDefaultServerUrl,
  MIN_SERVER_VERSION,
  validateServerNetwork,
  validateServerVersion
} from "@/chains/ergo/services/graphQlService";
import { validUrl } from "@/validators";
import { DEFAULT_EXPLORER_URL } from "@/constants/explorer";
import { Settings, useAppStore } from "@/stores/appStore";
import { useWalletStore } from "@/stores/walletStore";
import { log } from "@/common/logger";

export default defineComponent({
  name: "SettingsView",
  components: { ExtendedPublicKeyModal },
  setup() {
    return {
      v$: useVuelidate() as Ref<Validation<ValidationArgs<unknown>, unknown>>,
      app: useAppStore(),
      wallet: useWalletStore()
    };
  },
  data() {
    return {
      walletSettings: {
        name: "",
        avoidAddressReuse: false,
        hideUsedAddresses: true
      },
      globalSettings: {
        conversionCurrency: "",
        devMode: !MAINNET,
        graphQLServer: "",
        explorerUrl: "",
        blacklistedTokensLists: [] as string[]
      } as Settings,
      tokensBlacklists: {
        nsfw: true,
        scam: true
      },
      walletChanged: true,
      loading: true,
      currencies: [] as string[],
      xpkModalActive: false
    };
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
    tokensBlacklists: {
      deep: true,
      handler() {
        if (this.walletChanged) {
          this.walletChanged = false;
          return;
        }

        const lists = [];
        if (this.tokensBlacklists.nsfw) lists.push("nsfw");
        if (this.tokensBlacklists.scam) lists.push("scam");

        this.globalSettings.blacklistedTokensLists = lists;
      }
    },
    ["wallet.id"]: {
      immediate: true,
      deep: true,
      handler() {
        this.walletSettings = {
          name: this.wallet.name,
          ...this.wallet.settings
        };
        this.walletChanged = true;
      }
    }
  },
  created() {
    this.currencies = [this.app.settings.conversionCurrency];
    this.globalSettings = clone(this.app.settings);
    this.tokensBlacklists = {
      nsfw: this.globalSettings.blacklistedTokensLists.includes("nsfw"),
      scam: this.globalSettings.blacklistedTokensLists.includes("scam")
    };
  },
  async mounted() {
    try {
      this.currencies = await coinGeckoService.getSupportedCurrencyConversion();
    } catch (e) {
      log.error(e);
    }

    this.loading = false;
  },
  validations() {
    return {
      walletSettings: {
        name: {
          required: helpers.withMessage("Wallet name is required.", required)
        }
      },
      globalSettings: {
        explorerUrl: {
          validUrl
        },
        graphQLServer: {
          validUrl,
          network: helpers.withMessage(
            "Wrong server network.",
            helpers.withAsync(async (url: string) => {
              if (!url) {
                return true;
              }

              return await validateServerNetwork(url);
            })
          ),
          version: helpers.withMessage(
            `Unsupported server version. Minimum required version: ${MIN_SERVER_VERSION.join(".")}`,
            helpers.withAsync(async (url: string) => {
              if (!url) {
                return true;
              }

              return await validateServerVersion(url);
            })
          )
        }
      }
    };
  },
  methods: {
    async remove() {
      if (confirm(`Are you sure you want to remove '${this.wallet.name}'?`)) {
        this.app.deleteWallet(this.wallet.id);
      }
    },
    async updateWallet() {
      if (!(await this.v$.walletSettings.$validate())) return;

      this.wallet.$patch({
        name: this.walletSettings.name,
        settings: {
          avoidAddressReuse: this.walletSettings.avoidAddressReuse,
          hideUsedAddresses: this.walletSettings.hideUsedAddresses
        }
      });
    },
    async updateGlobal() {
      if (isEmpty(this.globalSettings.graphQLServer)) {
        this.globalSettings.graphQLServer = getDefaultServerUrl();
      }

      if (isEmpty(this.globalSettings.explorerUrl)) {
        this.globalSettings.explorerUrl = DEFAULT_EXPLORER_URL;
      }

      if (!(await this.v$.globalSettings.$validate())) {
        return;
      }

      if (!isEqual(this.app.settings, this.globalSettings)) {
        this.app.$patch({ settings: this.globalSettings });
      }
    }
  }
});
</script>
