<template>
  <div class="flex flex-col gap-5">
    <div class="flex flex-row gap-3">
      <div class="flex-grow">
        <label>Your address</label>
        <p class="rounded font-mono bg-gray-200 text-sm p-2 text-dark-800 break-all">
          {{ addresses[addresses.length - 1].address }}
          <vue-feather type="copy" size="12" />
        </p>
        <p class="text-xs pt-1 text-gray-700">Share this address to receive assets.</p>
      </div>
      <div class="text-right w-min">
        <canvas class="inline" id="primary-address-canvas"></canvas>
      </div>
    </div>
    <div>
      <button class="w-full btn">Add new address</button>
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
                <tr v-for="address in addresses.slice().reverse()" :key="address">
                  <td class="font-mono">
                    <span
                      >{{ $filters.compactString(address.address, 12) }}
                      <vue-feather type="copy" size="16" />
                      <!-- <vue-feather class="pl-1" type="info" size="16" /> -->
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
import { mapState } from "vuex";
import { defineComponent } from "vue";
import QRCode from "qrcode";

export default defineComponent({
  name: "ReceivePage",
  computed: mapState({ addresses: "currentAddresses" }),
  props: {
    title: { type: String, require: true },
    backButton: { type: Boolean, default: false }
  },
  mounted() {
    QRCode.toCanvas(
      document.getElementById("primary-address-canvas"),
      this.addresses[this.addresses.length - 1].address,
      {
        errorCorrectionLevel: "low",
        margin: 0,
        scale: 4
      }
    );
  }
});
</script>
