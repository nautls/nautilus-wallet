<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-row gap-4">
      <div class="flex-grow">
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
            <a :href="urlFor(mainAddress)" target="_blank">
              {{ mainAddress }}
            </a>
            <click-to-copy :content="mainAddress" class="mx-2" size="12" />
          </template>
        </div>
      </div>
      <div class="text-right w-auto">
        <div v-show="loading" class="skeleton rounded h-3 w-25 h-25"></div>
        <canvas
          v-show="!loading"
          id="primary-address-canvas"
          class="inline-block max-w-25 max-h-25 rounded"
        ></canvas>
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
                Address ({{ addresses.length
                }}<template v-if="hideUsed">/{{ stateAddresses.length }}</template
                >)
                <tool-tip
                  :label="hideUsed ? 'Show all addresses' : 'Hide empty used addresses'"
                  tip-class="normal-case"
                >
                  <a class="cursor-pointer inline-flex" @click="updateUsedAddressesFilter()">
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
          <tr v-for="address in addresses.slice().reverse()" v-else :key="address.script">
            <td class="font-mono">
              <div class="flex gap-2 text-gray-700">
                <a
                  :href="urlFor(address.script)"
                  :class="{ 'text-gray-400': isUsed(address) }"
                  target="_blank"
                  >{{ $filters.string.shorten(address.script, 10) }}</a
                >
                <tool-tip v-if="isLedger" label="Verify this address on <br /> your Ledger device">
                  <a class="cursor-pointer" @click="showOnLedger(address)">
                    <mdi-icon name="shield-check-outline" size="15" />
                  </a>
                </tool-tip>

                <click-to-copy :content="address.script" size="14" />

                <template v-if="!currentWallet.settings.avoidAddressReuse">
                  <vue-feather
                    v-if="currentWallet.settings.defaultChangeIndex === address.index"
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
import { isDefined, last } from "@fleet-sdk/common";
import QRCode from "qrcode";
import { defineComponent } from "vue";
import ConfirmAddressOnDevice from "../components/ConfirmAddressOnDevice.vue";
import { openModal } from "@/common/componentUtils";
import MdiIcon from "@/components/MdiIcon.vue";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import { ACTIONS } from "@/constants/store";
import {
  AddressState,
  StateAddress,
  StateWallet,
  UpdateChangeIndexCommand,
  UpdateUsedAddressesFilterCommand,
  WalletType
} from "@/types/internal";
import { useAppStore } from "@/stores/appStore";

export default defineComponent({
  name: "ReceiveView",
  components: { MdiIcon },
  setup() {
    return { app: useAppStore() };
  },
  data() {
    return {
      prevCount: 1,
      errorMsg: ""
    };
  },
  computed: {
    currentWallet(): StateWallet {
      return this.$store.state.currentWallet;
    },
    isLedger(): boolean {
      return this.currentWallet.type === WalletType.Ledger;
    },
    stateAddresses(): StateAddress[] {
      return this.$store.state.currentAddresses;
    },
    addresses(): StateAddress[] {
      const settings = this.currentWallet.settings;
      if (settings.hideUsedAddresses) {
        return this.stateAddresses.filter(
          (a) =>
            a.state === AddressState.Unused ||
            (a.state === AddressState.Used && a.balance) ||
            (!settings.avoidAddressReuse && a.index === settings.defaultChangeIndex)
        );
      }
      return this.stateAddresses;
    },
    hideUsed(): boolean {
      return this.currentWallet.settings.hideUsedAddresses;
    },
    loading(): boolean {
      return this.addresses.length === 0 && this.$store.state.loading.addresses;
    },
    avoidingReuse(): boolean {
      return this.currentWallet.settings.avoidAddressReuse;
    },
    mainAddress(): string | undefined {
      const settings = this.currentWallet.settings;
      return this.avoidingReuse
        ? last(this.addresses)?.script
        : this.addresses.find((a) => a.index === settings.defaultChangeIndex)?.script;
    },
    hideBalances(): boolean {
      return this.app.settings.hideBalances;
    }
  },
  watch: {
    ["addresses.length"](newLen, oldLen) {
      const length = oldLen || 1;
      if (length > 1) {
        this.prevCount = length;
      }
    },
    mainAddress: {
      immediate: true,
      handler() {
        this.errorMsg = "";
        this.$nextTick(() => {
          if (!this.mainAddress) {
            return;
          }
          QRCode.toCanvas(document.getElementById("primary-address-canvas"), this.mainAddress, {
            errorCorrectionLevel: "low",
            margin: 0,
            scale: 4
          });
        });
      }
    }
  },
  methods: {
    updateDefaultChangeIndex(index: number) {
      this.$store.dispatch(ACTIONS.UPDATE_CHANGE_ADDRESS_INDEX, {
        walletId: this.currentWallet.id,
        index
      } as UpdateChangeIndexCommand);
    },
    updateUsedAddressesFilter() {
      this.$store.dispatch(ACTIONS.UPDATE_USED_ADDRESSES_FILTER, {
        walletId: this.currentWallet.id,
        filter: !this.hideUsed
      } as UpdateUsedAddressesFilterCommand);
    },
    async newAddress() {
      try {
        await this.$store.dispatch(ACTIONS.NEW_ADDRESS);
      } catch (e) {
        this.errorMsg = (e as Error).message;
      }
    },
    ergBalanceFor(address: StateAddress): string {
      return (
        address.balance?.find((a) => a.tokenId === ERG_TOKEN_ID)?.confirmedAmount.toFormat() || "0"
      );
    },
    isUsed(address: StateAddress): boolean {
      return address.state === AddressState.Used;
    },
    hasPendingBalance(address: StateAddress): boolean {
      return isDefined(
        address.balance?.find(
          (b) => isDefined(b.unconfirmedAmount) && !b.unconfirmedAmount.isZero()
        )
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
