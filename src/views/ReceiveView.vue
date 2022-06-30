<template>
  <div class="flex flex-col gap-5">
    <div class="flex flex-row gap-5">
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
          class="inline-block max-w-25 max-h-25 rounded"
          id="primary-address-canvas"
        ></canvas>
      </div>
    </div>
    <div
      v-if="isLedger"
      class="rounded rounded border-1 bg-yellow-100 border-yellow-300 text-sm py-3 px-4"
    >
      <strong>Never send more than ten distinct tokens</strong> in a single transaction to a Ledger
      wallet. Due to device's memory limitations your assets can get stuck in your wallet.
    </div>
    <div>
      <button class="w-full btn" @click="newAddress()" :disabled="loading || errorMsg != ''">
        New address
      </button>
      <p class="input-error" v-if="errorMsg != ''">
        {{ errorMsg }}
      </p>
    </div>
    <div class="border rounded">
      <table class="table">
        <thead>
          <tr>
            <th>
              Address ({{ addresses.length
              }}<template v-if="hideUsed">/{{ stateAddresses.length }}</template
              >)
              <tool-tip
                :label="hideUsed ? 'Show all addresses' : 'Hide empty used addresses'"
                tip-class="normal-case"
                class="pl-1"
              >
                <a class="cursor-pointer" @click="updateUsedAddressesFilter()">
                  <mdi-icon
                    class="align-middle"
                    :name="hideUsed ? 'filter-off' : 'filter'"
                    size="16"
                  />
                </a>
              </tool-tip>
            </th>
            <th class="text-right">Balance</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading" v-for="i in prevCount" :key="i">
            <td>
              <div class="skeleton inline-block h-3 w-2/3 rounded"></div>
            </td>
            <td class="text-right">
              <div class="skeleton inline-block h-3 w-1/3 rounded"></div>
            </td>
          </tr>
          <tr v-else v-for="address in addresses.slice().reverse()" :key="address.script">
            <td class="font-mono" :class="{ 'text-gray-400': isUsed(address) }">
              <a :href="urlFor(address.script)" target="_blank">{{
                $filters.compactString(address.script, 10)
              }}</a>
              <div class="align-middle inline-block">
                <click-to-copy :content="address.script" class="mx-2" size="12" />

                <template v-if="!currentWallet.settings.avoidAddressReuse">
                  <vue-feather
                    v-if="currentWallet.settings.defaultChangeIndex === address.index"
                    type="check-circle"
                    class="text-green-600"
                    size="12"
                  />
                  <tool-tip v-else label="Set as default<br />address">
                    <a class="cursor-pointer" @click="updateDefaultChangeIndex(address.index)">
                      <vue-feather type="circle" size="12" />
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
              <span class="float-left">Σ</span>
              <span> {{ ergBalanceFor(address) }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import QRCode from "qrcode";
import { find, last } from "lodash";
import {
  StateAddress,
  StateWallet,
  UpdateChangeIndexCommand,
  UpdateUsedAddressesFilterCommand,
  WalletType
} from "@/types/internal";
import { ADDRESS_URL } from "@/constants/explorer";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import { AddressState } from "@/types/internal";
import { ACTIONS } from "@/constants/store";
import MdiIcon from "@/components/MdiIcon.vue";

export default defineComponent({
  name: "ReceiveView",
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
        : find(this.addresses, (a) => a.index === settings.defaultChangeIndex)?.script;
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
  data() {
    return {
      prevCount: 1,
      errorMsg: ""
    };
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
      } catch (e: any) {
        this.errorMsg = e.message;
      }
    },
    ergBalanceFor(address: StateAddress): string {
      return (
        find(address.balance, (a) => a.tokenId === ERG_TOKEN_ID)?.confirmedAmount.toFormat() || "0"
      );
    },
    isUsed(address: StateAddress): boolean {
      return address.state === AddressState.Used;
    },
    hasPendingBalance(address: StateAddress): boolean {
      return !!find(address.balance, (b) => b.unconfirmedAmount && !b.unconfirmedAmount.isZero());
    },
    urlFor(address: string | undefined): string {
      return `${ADDRESS_URL}${address}`;
    }
  },
  components: { MdiIcon }
});
</script>
