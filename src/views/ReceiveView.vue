<template>
  <div class="flex flex-col gap-5">
    <div class="flex flex-row gap-3">
      <div class="flex-grow">
        <label>Your address</label>
        <div class="rounded font-mono bg-gray-200 text-sm p-2 text-dark-800 break-all">
          <template v-if="loading">
            <div class="skeleton h-3 w-full rounded"></div>
            <div class="skeleton h-3 w-full rounded"></div>
            <div class="skeleton h-3 w-1/2 rounded"></div>
          </template>
          <template v-else>
            {{ addresses[addresses.length - 1].address }}
            <click-to-copy :content="addresses[addresses.length - 1].address" size="12" />
          </template>
        </div>
        <p class="text-xs pt-1 text-gray-600">Share this address to receive assets.</p>
      </div>
      <div class="text-right w-min">
        <div v-show="loading" class="skeleton h-3 w-29 h-29"></div>
        <canvas v-show="!loading" class="inline w-29 h-29" id="primary-address-canvas"></canvas>
      </div>
    </div>
    <div>
      <button class="w-full btn" :disabled="loading">Add new address</button>
    </div>
    <div class="flex flex-col">
      <div class="-my-2 -mx-8">
        <div class="min-w-full py-2 px-8 align-middle inline-block">
          <div class="border-b rounded-lg border-gray-200 shadow overflow-hidden">
            <table class="table">
              <thead>
                <tr>
                  <th>Address</th>
                  <th class="text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="loading">
                  <td>
                    <div class="skeleton inline-block h-3 w-2/3 rounded"></div>
                  </td>
                  <td class="text-right">
                    <div class="skeleton inline-block h-3 w-1/3 rounded"></div>
                  </td>
                </tr>
                <tr v-else v-for="address in addresses.slice().reverse()" :key="address.address">
                  <td class="font-mono">
                    <span
                      >{{ $filters.compactString(address.address, 12) }}
                      <click-to-copy :content="address.address" size="12" />
                    </span>
                  </td>
                  <td class="text-right">
                    <span v-if="address.balance">{{ address.balance.nanoErgs / 1000000000 }}</span>
                    <span v-else>0</span>
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
import { last } from "lodash";
import { StateAddress } from "@/store/stateTypes";

export default defineComponent({
  name: "ReceiveView",
  computed: {
    addresses(): StateAddress[] {
      return this.$store.state.currentAddresses;
    },
    loading(): boolean {
      return this.addresses.length === 0;
    },
    lastAddress(): string | undefined {
      return last(this.addresses)?.address;
    }
  },
  watch: {
    lastAddress: {
      immediate: true,
      handler() {
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
  }
});
</script>
