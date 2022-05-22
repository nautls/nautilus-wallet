<template>
  <div class="flex-col flex gap-4 h-full">
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
    <div class="text-gray-600">
      <ledger-device
        :bottom-text="statusText"
        :state="state"
        :loading="loading"
        :connected="connected"
        :app-id="appId"
        :screen-text="screenText"
      />
    </div>
    <div v-if="confirmationAddress" class="text-sm">
      <div class="rounded font-mono bg-gray-200 p-2 break-all">
        <p><label>Address:</label> {{ confirmationAddress }}</p>
      </div>
      <p class="p-1">
        Before you continue, please make sure the address above is
        <span class="font-semibold">EXACTLY</span> the same as what is displayed on your device and
        then hit <span class="font-semibold">Approve</span> to confirm.
      </p>
    </div>
    <div class="flex-grow"></div>
    <button type="button" v-if="!loading" @click="add()" class="w-full btn">
      <span>Connect</span>
    </button>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { mapActions } from "vuex";
import { WalletType } from "@/types/internal";
import { ACTIONS } from "@/constants/store/actions";
import LoadingIndicator from "@/components/LoadingIndicator.vue";
import useVuelidate from "@vuelidate/core";
import { required, helpers } from "@vuelidate/validators";
import { DeviceError, ErgoLedgerApp, RETURN_CODE } from "ledger-ergo-js";
import WebUSBTransport from "@ledgerhq/hw-transport-webusb";
import Bip32 from "@/api/ergo/bip32";
import { DERIVATION_PATH } from "@/constants/ergo";
import { LedgerDeviceModelId, LedgerState } from "@/constants/ledger";

export default defineComponent({
  name: "ConnectLedgerView",
  components: { LoadingIndicator },
  setup() {
    return { v$: useVuelidate() };
  },
  data() {
    return {
      loading: false,
      connected: false,
      walletName: "",
      confirmationAddress: "",
      statusText: "",
      screenText: "",
      state: LedgerState.unknown,
      deviceModel: "",
      appId: 0
    };
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
      this.state = LedgerState.unknown;
      this.statusText = "Connecting...";
      let pk = "";
      let app!: ErgoLedgerApp;

      try {
        app = new ErgoLedgerApp(await WebUSBTransport.create()).useAuthToken().enableDebugMode();
        this.appId = app.authToken ?? 0;
        this.deviceModel = app.transport.deviceModel?.id.toString() ?? LedgerDeviceModelId.nanoX;

        if ((await app.getAppName()).name !== "Ergo") {
          this.state = LedgerState.error;
          this.loading = false;
          this.statusText = "Ergo App is not opened.";
          app.transport.close();
          return;
        }

        this.connected = true;
      } catch (e) {
        this.state = LedgerState.deviceNotFound;
        this.loading = false;
        this.statusText = "";
        console.error(e);
        return;
      }

      this.statusText = "Waiting for device extended public key export confirmation...";
      try {
        const ledgerPk = await app.getExtendedPublicKey("m/44'/429'/0'");
        const bip32 = Bip32.fromPublicKey(
          { publicKey: ledgerPk.publicKey, chainCode: ledgerPk.chainCode },
          "0"
        );

        pk = bip32.extendedPublicKey.toString("hex");
        this.screenText = "Confirm Address";
        this.statusText = "";
        this.confirmationAddress = bip32.deriveAddress(0).script;
        if (await app.showAddress(DERIVATION_PATH + "/0")) {
          this.state = LedgerState.success;
        }
      } catch (e) {
        console.error(e);
        this.loading = false;
        this.state = LedgerState.error;

        if (e instanceof DeviceError) {
          switch (e.code) {
            case RETURN_CODE.DENIED:
              if (this.confirmationAddress) {
                this.statusText = "Address not confirmed.";
                this.confirmationAddress = "";
              } else {
                this.statusText = "Extended public key export denied.";
              }
              break;
            case RETURN_CODE.INTERNAL_CRYPTO_ERROR:
              this.statusText =
                "It looks like your device is locked. Make sure it is unlocked before proceeding.";
              break;
            default:
              this.statusText = `[Device error] ${e.message}`;
          }
        } else {
          this.statusText = `[Unknown error] ${e instanceof Error ? e.message : e}`;
        }

        return;
      } finally {
        this.connected = false;
        app.transport.close();
      }

      this.confirmationAddress = "";
      this.statusText = "Syncing...";

      try {
        await this.putWallet({
          name: this.walletName,
          extendedPublicKey: pk,
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
