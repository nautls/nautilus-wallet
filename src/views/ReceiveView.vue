<template>
  <div class="flex flex-col gap-5">
    <div class="flex flex-row gap-5">
      <div class="flex-grow">
        <label>Your current address</label>
        <div class="rounded font-mono bg-gray-200 text-sm p-2 break-all">
          <template v-if="loading">
            <div class="skeleton h-3 w-full rounded"></div>
            <div class="skeleton h-3 w-full rounded"></div>
            <div class="skeleton h-3 w-1/2 rounded"></div>
          </template>
          <template v-else>
            <a :href="urlFor(lastAddress)" target="_blank">
              {{ lastAddress }}
            </a>
            <click-to-copy :content="lastAddress" class="mx-2" size="12" />
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
    <div>
      <button class="w-full btn" @click="newAddress()" :disabled="loading || errorMsg != ''">
        New address
      </button>
      <p class="input-error" v-if="errorMsg != ''">
        {{ errorMsg }}
      </p>
    </div>
    <div class="flex flex-col">
      <div class="-my-2 -mx-8">
        <div class="min-w-full py-2 px-8 align-middle inline-block">
          <div class="border-b rounded-lg border-gray-200 shadow">
            <table class="table">
              <thead>
                <tr>
                  <th>Address ({{ addresses.length }})</th>
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
                      $filters.compactString(address.script, 12)
                    }}</a>
                    <click-to-copy :content="address.script" class="mx-2" size="12" />
                    <tool-tip
                      v-if="hasPendingBalance(address)"
                      label="Pending transaction<br />for this address"
                      class="align-middle"
                    >
                      <loading-indicator class="w-4 h-4" />
                    </tool-tip>
                  </td>
                  <td class="text-right">
                    <span>{{ ergBalanceFor(address) }}</span>
                    ERG
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import QRCode from "qrcode";
import { find, last } from "lodash";
import { StateAddress, StateWallet } from "@/types/internal";
import { ADDRESS_URL } from "@/constants/explorer";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import { AddressState } from "@/types/internal";
import { ACTIONS } from "@/constants/store";

export default defineComponent({
  name: "ReceiveView",
  computed: {
    currentWallet(): StateWallet {
      return this.$store.state.currentWallet;
    },
    stateAddresses(): StateAddress[] {
      return this.$store.state.currentAddresses;
    },
    addresses(): StateAddress[] {
      if (this.currentWallet.settings.hideUsedAddresses) {
        return this.stateAddresses.filter(
          (a) => a.state === AddressState.Unused || (a.state === AddressState.Used && a.balance)
        );
      }

      return this.stateAddresses;
    },
    loading(): boolean {
      return this.addresses.length === 0 && this.$store.state.loading.addresses;
    },
    lastAddress(): string | undefined {
      return last(this.addresses)?.script;
    }
  },
  watch: {
    ["addresses.length"](newLen, oldLen) {
      const length = oldLen || 1;
      if (length > 1) {
        this.prevCount = length;
      }
    },
    lastAddress: {
      immediate: true,
      handler() {
        this.errorMsg = "";
        this.$nextTick(() => {
          if (!this.lastAddress) {
            return;
          }

          QRCode.toCanvas(document.getElementById("primary-address-canvas"), this.lastAddress, {
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
  }
});
</script>
