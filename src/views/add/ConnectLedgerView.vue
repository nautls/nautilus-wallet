<template>
  <div class="flex h-full flex-col gap-4 py-4">
    <div>
      <label
        >Wallet name
        <input
          v-model.lazy="walletName"
          :disabled="loading"
          maxlength="50"
          type="text"
          class="control block w-full"
          @blur="v$.walletName.$touch()"
        />
        <p v-if="v$.walletName.$error" class="input-error">
          {{ v$.walletName.$errors[0].$message }}
        </p>
      </label>
    </div>
    <div class="text-gray-600">
      <ledger-device
        v-show="appId"
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
      <div class="break-all rounded border border-gray-200 bg-gray-100 p-2 font-mono text-sm">
        <p><label>Address:</label> {{ confirmationAddress }}</p>
      </div>
      <p class="p-1">
        Before you continue, please make sure the address above is
        <span class="font-semibold">EXACTLY</span> the same as what is displayed on your device and
        then hit <span class="font-semibold">Approve</span> to confirm.
      </p>
    </div>
    <div class="flex-grow"></div>
    <button v-if="!loading" type="button" class="btn w-full" @click="add()">
      <span>Connect</span>
    </button>
  </div>
</template>

<script lang="ts">
import WebUSBTransport from "@ledgerhq/hw-transport-webusb";
import { useVuelidate } from "@vuelidate/core";
import { helpers, required } from "@vuelidate/validators";
import { DeviceError, ErgoLedgerApp, Network, RETURN_CODE } from "ledger-ergo-js";
import { defineComponent } from "vue";
import { hex } from "@fleet-sdk/crypto";
import HdKey from "@/chains/ergo/hdKey";
import { DERIVATION_PATH, MAINNET } from "@/constants/ergo";
import { LedgerDeviceModelId } from "@/constants/ledger";
import { ProverStateType, WalletType } from "@/types/internal";
import { log } from "@/common/logger";
import { useAppStore } from "@/stores/appStore";
import { useWalletStore } from "@/stores/walletStore";
import LedgerDevice from "@/components/LedgerDevice.vue";

export default defineComponent({
  name: "ConnectLedgerView",
  components: { LedgerDevice },
  setup() {
    return { v$: useVuelidate(), app: useAppStore(), wallet: useWalletStore() };
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
    async add() {
      const valid = await this.v$.$validate();
      if (!valid) return;

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

        this.connected = true;
        this.screenContent = "Extended Public Key Export";
      } catch (e) {
        log.error(e);
        this.state = ProverStateType.unavailable;
        this.loading = false;
        this.caption = "";

        return;
      }

      this.caption =
        "Please confirm the export of the <strong>Extended Public Key</strong> on your device.";
      try {
        const ledgerPk = await app.getExtendedPublicKey("m/44'/429'/0'");
        const key = HdKey.fromPublicKey(
          { publicKey: ledgerPk.publicKey, chainCode: ledgerPk.chainCode },
          "m/0"
        );

        pk = hex.encode(key.extendedPublicKey);
        this.screenContent = "Confirm Address";
        this.caption = "";
        this.confirmationAddress = key.deriveAddress(0).script;
        const network = MAINNET ? Network.Mainnet : Network.Testnet;
        if (await app.showAddress(DERIVATION_PATH + "/0", network)) {
          this.state = ProverStateType.success;
          this.screenContent = "Confirmed";
        }
      } catch (e) {
        this.loading = false;
        this.state = ProverStateType.error;
        log.error(e);

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
        const walletId = await this.app.putWallet({
          name: this.walletName,
          extendedPublicKey: pk,
          type: WalletType.Ledger
        });

        await this.wallet.load(walletId, { syncInBackground: false });
      } catch (e) {
        log.error(e);
        this.loading = false;
        return;
      }

      this.$router.push({ name: "assets-page" });
    }
  }
});
</script>
@/common/logger
