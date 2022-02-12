<template>
  <div class="flex-col flex gap-4 h-full">
    <page-title title="Ledger connection" back-button />
    <div>
      <label
        >Wallet name
        <input
          :disabled="loading"
          maxlength="50"
          type="text"
          @blur="v$.walletName.$touch()"
          v-model.lazy="walletName"
          class="w-full control block"
        />
        <p class="input-error" v-if="v$.walletName.$error">
          {{ v$.walletName.$errors[0].$message }}
        </p>
      </label>
    </div>
    <div v-if="confirmAddress" class="text-sm">
      <label>Address</label>
      <div class="rounded font-mono bg-gray-200 p-2 break-all">{{ confirmAddress }}</div>
      <p class="p-1">
        Before you continue, please make sure the address above is
        <span class="font-semibold">EXACTLY</span> the same as what is displayed on your device and
        then hit «<span class="font-semibold">Approve</span>»
      </p>
    </div>
    <div class="flex-grow text-gray-600">
      <div v-if="isConnected" class="text-sm w-65 mx-auto text-center">
        <div class="relative">
          <img src="@/assets/images/hw-devices/ledger-s.svg" class="w-full" />
          <div v-if="appId" class="absolute top-30.5 w-30 left-11 text-light-500 text-xs">
            Application<br />
            <span class="font-bold">{{ appIdHex }}</span>
          </div>
        </div>
        {{ deviceName }}
      </div>
    </div>
    <div v-if="statusText" class="text-center">
      <loading-indicator v-if="loading" type="circular" class="w-15 h-15" />
      <p class="pt-3">{{ statusText }}</p>
    </div>
    <div>
      <button type="button" :disabled="loading" @click="add()" class="w-full btn">
        <span>Connect</span>
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { mapActions } from "vuex";
import { WalletType } from "@/types/internal";
import { ACTIONS } from "@/constants/store/actions";
import PageTitle from "@/components/PageTitle.vue";
import LoadingIndicator from "@/components/LoadingIndicator.vue";
import useVuelidate from "@vuelidate/core";
import { required, helpers } from "@vuelidate/validators";

import { ErgoLedgerApp } from "ledgerjs-hw-app-ergo";
import HidTransport from "@ledgerhq/hw-transport-webhid";
import Bip32 from "@/api/ergo/bip32";
import { DERIVATION_PATH } from "@/constants/ergo";

export default defineComponent({
  name: "ConnectLedgerView",
  components: { PageTitle, LoadingIndicator },
  setup() {
    return { v$: useVuelidate() };
  },
  data() {
    return {
      loading: false,
      walletName: "",
      publicKey: "",
      confirmAddress: "",
      statusText: "",
      deviceName: "",
      appId: 0,
      isConnected: false,
      pk: { publicKey: "", chainCode: "" }
    };
  },
  computed: {
    appIdHex(): string {
      if (!this.appId) {
        return "";
      }

      return `0x${this.appId.toString(16)}`;
    }
  },
  validations() {
    return {
      walletName: { required: helpers.withMessage("Wallet name is required.", required) }
    };
  },
  methods: {
    ...mapActions({ putWallet: ACTIONS.PUT_WALLET }),
    async add() {
      const isValid = await this.v$.$validate();
      if (!isValid) {
        return;
      }

      this.loading = true;
      this.statusText = "Connecting...";

      let app!: ErgoLedgerApp;
      try {
        app = new ErgoLedgerApp(await HidTransport.create());
        this.deviceName = app.transport.deviceModel?.productName ?? "";
        this.appId = app.authToken;
        this.isConnected = true;
      } catch (e) {
        console.error(e);
        this.statusText = "Ledger device not detected.";
      }

      this.statusText = "Waiting for device confirmation...";
      try {
        const ledgerPk = await app.getExtendedPublicKey("m/44'/429'/0'", true);
        const bip32 = Bip32.fromPublicKey(
          { publicKey: ledgerPk.publicKey, chainCode: ledgerPk.chainCode },
          "0"
        );

        this.publicKey = bip32.extendedPublicKey.toString("hex");
        this.statusText = "Waiting for address confirmation...";
        this.confirmAddress = bip32.deriveAddress(0).script;
        if (!(await app.showAddress(DERIVATION_PATH + "/0"))) {
          this.loading = false;
          this.statusText = "";
          this.confirmAddress = "";
          this.publicKey = "";
          return;
        }
      } finally {
        // this.loading = false;
        if (!app) {
          return;
        }
        app.transport.close();
      }

      this.confirmAddress = "";
      this.statusText = "Syncing...";

      try {
        await this.putWallet({
          name: this.walletName,
          extendedPublicKey: this.publicKey,
          type: WalletType.Ledger
        });
      } catch (e: any) {
        this.loading = false;
        return;
      }

      this.$router.push({ name: "assets-page" });
    }
  }
});
</script>
