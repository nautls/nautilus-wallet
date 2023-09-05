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
        :connected="connected"
        :screen-text="screenContent"
        :caption="caption"
        :model="model"
        :loading="loading"
        :state="state"
        :app-id="appId"
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
import { ProverStateType, WalletType } from "@/types/internal";
import { ACTIONS } from "@/constants/store/actions";
import useVuelidate from "@vuelidate/core";
import { required, helpers } from "@vuelidate/validators";
import { DeviceError, ErgoLedgerApp, Network, RETURN_CODE } from "ledger-ergo-js";
import WebUSBTransport from "@ledgerhq/hw-transport-webusb";
import Bip32 from "@/api/ergo/bip32";
import { DERIVATION_PATH, MAINNET } from "@/constants/ergo";
import { LedgerDeviceModelId } from "@/constants/ledger";

export default defineComponent({
  name: "ConnectLedgerView",
  setup() {
    return { v$: useVuelidate() };
  },
  data() {
    return {
      connected: false,
      loading: false,
      walletName: "",
      confirmationAddress: "",
      caption: "",
      screenContent: "",
      state: undefined as ProverStateType | undefined,
      model: LedgerDeviceModelId.nanoX,
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
      this.state = undefined;
      this.caption = "Connecting...";
      let pk = "";
      let app!: ErgoLedgerApp;

      try {
        app = new ErgoLedgerApp(await WebUSBTransport.create()).useAuthToken().enableDebugMode();
        this.appId = app.authToken ?? 0;
        this.model =
          (app.transport.deviceModel?.id.toString() as LedgerDeviceModelId) ??
          LedgerDeviceModelId.nanoX;

        if ((await app.getAppName()).name !== "Ergo") {
          this.state = ProverStateType.error;
          this.loading = false;
          this.caption = "Ergo App is not opened.";
          app.transport.close();
          return;
        }

        // this.state = ProverStateType.busy;
        this.connected = true;
        this.screenContent = "Extended Public Key Export";
      } catch (e) {
        this.state = ProverStateType.unavailable;
        this.loading = false;
        this.caption = "";
        console.error(e);
        return;
      }

      this.caption =
        "Please confirm the export of the <strong>Extended Public Key</strong> on your device.";
      try {
        const ledgerPk = await app.getExtendedPublicKey("m/44'/429'/0'");
        const bip32 = Bip32.fromPublicKey(
          { publicKey: ledgerPk.publicKey, chainCode: ledgerPk.chainCode },
          "0"
        );

        pk = bip32.extendedPublicKey.toString("hex");
        this.screenContent = "Confirm Address";
        this.caption = "";
        this.confirmationAddress = bip32.deriveAddress(0).script;
        const network = MAINNET ? Network.Mainnet : Network.Testnet;
        if (await app.showAddress(DERIVATION_PATH + "/0", network)) {
          this.state = ProverStateType.success;
          this.screenContent = "Confirmed";
        }
      } catch (e) {
        console.error(e);
        this.loading = false;
        this.state = ProverStateType.error;

        if (e instanceof DeviceError) {
          switch (e.code) {
            case RETURN_CODE.DENIED:
              if (this.confirmationAddress) {
                this.caption = "Address not confirmed.";
                this.confirmationAddress = "";
              } else {
                this.caption = "Extended public key export denied.";
              }
              break;
            case RETURN_CODE.INTERNAL_CRYPTO_ERROR:
              this.caption =
                "It looks like your device is locked. Make sure it is unlocked before proceeding.";
              break;
            default:
              this.caption = `[Device error] ${e.message}`;
          }
        } else {
          this.caption = `[Unknown error] ${e instanceof Error ? e.message : e}`;
        }

        return;
      } finally {
        this.connected = false;
        app.transport.close();
      }

      this.confirmationAddress = "";
      this.caption = "Syncing...";

      try {
        await this.putWallet({
          name: this.walletName,
          extendedPublicKey: pk,
          type: WalletType.Ledger
        });
      } catch (e) {
        this.loading = false;
        return;
      }

      this.$router.push({ name: "assets-page" });
    }
  }
});
</script>
