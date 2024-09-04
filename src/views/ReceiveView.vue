<template>
  <div class="flex flex-col gap-4 py-4">
    <div class="flex flex-row gap-4">
      <div class="w-full">
        <label
          ><span v-if="avoidingReuse">Your current address</span>
          <span v-else>Your default address</span></label
        >
        <div class="rounded font-mono bg-gray-100 text-sm p-2 break-all border-gray-200 border">
          <template v-if="loading">
            <div class="skeleton h-3 w-full rounded"></div>
            <div class="skeleton h-3 w-full rounded"></div>
            <div class="skeleton h-3 w-1/2 rounded"></div>
          </template>
          <template v-else>
            <a :href="urlFor(wallet.changeAddress?.script)" target="_blank">
              {{ wallet.changeAddress?.script }}
            </a>
            <click-to-copy :content="wallet.changeAddress?.script" class="mx-2" size="12" />
          </template>
        </div>
      </div>
      <div class="text-right">
        <div v-if="loading" class="skeleton rounded h-3 w-25 h-25"></div>
        <qr-code
          v-else
          :data="wallet.changeAddress?.script"
          class="inline-block w-25 h-25 rounded"
        />
      </div>
    </div>
    <div
      v-if="isLedger"
      class="rounded rounded border-1 bg-yellow-100 border-yellow-300 text-sm py-3 px-4"
    >
      <strong
        >Do not send more than 20 different tokens to a Ledger wallet in one transaction.</strong
      >
      Due to device's memory limitations, your funds may get stuck in your wallet.
    </div>
    <div>
      <button class="w-full btn" :disabled="loading || errorMsg != ''" @click="newAddress()">
        New address
      </button>
      <p v-if="errorMsg != ''" class="input-error">
        {{ errorMsg }}
      </p>
    </div>
    <div class="border rounded">
      <table class="table">
        <thead>
          <tr>
            <th>
              <div class="flex-row justify-start flex gap-2 align-middle">
                Address ({{ wallet.filteredAddresses.length
                }}<template v-if="hideUsed">/{{ wallet.addresses.length }}</template
                >)
                <tool-tip
                  :label="hideUsed ? 'Show all addresses' : 'Hide empty used addresses'"
                  tip-class="normal-case"
                >
                  <a class="cursor-pointer inline-flex" @click="toggleUsedAddressesFilter()">
                    <mdi-icon :name="hideUsed ? 'filter-off' : 'filter'" size="16" />
                  </a>
                </tool-tip>
              </div>
            </th>
            <th>
              <div class="flex-row justify-end flex gap-2 align-middle">
                <tool-tip
                  :label="hideBalances ? 'Show' : 'Hide'"
                  tip-class="normal-case"
                  class="align-middle"
                >
                  <a class="cursor-pointer inline-flex" @click="toggleHideBalance()">
                    <mdi-icon :name="hideBalances ? 'eye-off' : 'eye'" size="16" />
                  </a>
                </tool-tip>
                Balance
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <template v-if="loading">
            <tr v-for="i in prevCount" :key="i">
              <td>
                <div class="skeleton inline-block h-3 w-2/3 rounded"></div>
              </td>
              <td class="text-right">
                <div class="skeleton inline-block h-3 w-1/3 rounded"></div>
              </td>
            </tr>
          </template>
          <tr v-for="address in reversedAddresses" v-else :key="address.script">
            <td class="font-mono">
              <div class="flex gap-2 text-gray-700">
                <a
                  :href="urlFor(address.script)"
                  :class="{ 'text-gray-400': isUsed(address) }"
                  target="_blank"
                  >{{ format.string.shorten(address.script, 10) }}</a
                >
                <tool-tip v-if="isLedger" label="Verify this address on <br /> your Ledger device">
                  <a class="cursor-pointer" @click="showOnLedger(address)">
                    <mdi-icon name="shield-check-outline" size="15" />
                  </a>
                </tool-tip>

                <click-to-copy :content="address.script" size="14" />

                <template v-if="!wallet.settings.avoidAddressReuse">
                  <vue-feather
                    v-if="wallet.settings.defaultChangeIndex === address.index"
                    type="check-circle"
                    class="text-green-600"
                    size="14"
                  />
                  <tool-tip v-else label="Set as default<br />address">
                    <a class="cursor-pointer" @click="updateDefaultChangeIndex(address.index)">
                      <vue-feather type="circle" size="14" />
                    </a>
                  </tool-tip>
                </template>

                <tool-tip
                  v-if="hasPendingBalance(address)"
                  label="Pending transaction<br />for this address"
                  class="pl-2"
                >
                  <loading-indicator class="w-3 h-3" />
                </tool-tip>
              </div>
            </td>
            <td class="text-right">
              <div
                v-if="hideBalances"
                class="skeleton animate-none h-4.5 w-2/4 rounded align-middle inline-block"
              ></div>
              <template v-else>
                <span class="float-left">Σ</span>
                <span> {{ ergBalanceFor(address) }}</span>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script lang="ts">
import { isDefined } from "@fleet-sdk/common";
import { defineComponent } from "vue";
import ConfirmAddressOnDevice from "../components/ConfirmAddressOnDevice.vue";
import { openModal } from "@/common/componentUtils";
import MdiIcon from "@/components/MdiIcon.vue";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import { AddressState, StateAddress, WalletType } from "@/types/internal";
import { useAppStore } from "@/stores/appStore";
import { useWalletStore } from "@/stores/walletStore";
import { useFormat, useQrCode } from "@/composables";

export default defineComponent({
  name: "ReceiveView",
  components: { MdiIcon, qrCode: useQrCode({ border: 0 }) },
  setup() {
    return { app: useAppStore(), wallet: useWalletStore(), format: useFormat() };
  },
  data() {
    return {
      prevCount: 1,
      errorMsg: ""
    };
  },
  computed: {
    isLedger(): boolean {
      return this.wallet.type === WalletType.Ledger;
    },
    reversedAddresses(): StateAddress[] {
      return this.wallet.filteredAddresses.slice().reverse();
    },
    hideUsed(): boolean {
      return this.wallet.settings.hideUsedAddresses;
    },
    loading(): boolean {
      return this.wallet.addresses.length === 0 && this.wallet.loading;
    },
    avoidingReuse(): boolean {
      return this.wallet.settings.avoidAddressReuse;
    },
    hideBalances(): boolean {
      return this.app.settings.hideBalances;
    }
  },
  watch: {
    "wallet.addresses"(_, oldLen) {
      const length = oldLen || 1;
      if (length > 1) this.prevCount = length;
    }
  },
  methods: {
    updateDefaultChangeIndex(index: number) {
      this.wallet.settings.defaultChangeIndex = index;
    },
    toggleUsedAddressesFilter() {
      this.wallet.settings.hideUsedAddresses = !this.wallet.settings.hideUsedAddresses;
    },
    async newAddress() {
      try {
        await this.wallet.deriveNewAddress();
      } catch (e) {
        this.errorMsg = (e as Error).message;
      }
    },
    ergBalanceFor(address: StateAddress): string {
      return (
        address.assets?.find((a) => a.tokenId === ERG_TOKEN_ID)?.confirmedAmount.toFormat() || "0"
      );
    },
    isUsed(address: StateAddress): boolean {
      return address.state === AddressState.Used;
    },
    hasPendingBalance(address: StateAddress): boolean {
      return isDefined(
        address.assets?.find((b) => isDefined(b.unconfirmedAmount) && !b.unconfirmedAmount.isZero())
      );
    },
    urlFor(address: string | undefined): string {
      return new URL(`/addresses/${address}`, this.app.settings.explorerUrl).toString();
    },
    toggleHideBalance(): void {
      this.app.settings.hideBalances = !this.app.settings.hideBalances;
    },
    showOnLedger(address: StateAddress) {
      openModal(ConfirmAddressOnDevice, {
        props: { address: address.script, index: address.index }
      });
    }
  }
});
</script>
