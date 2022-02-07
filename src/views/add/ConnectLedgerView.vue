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
    <div class="flex-grow">
      <div v-if="confirmAddress" class="text-sm">
        <label>Address</label>
        <div class="rounded font-mono bg-gray-200 p-2 break-all">{{ confirmAddress }}</div>
        <p class="p-1">
          Before you continue, please make sure the address above is
          <span class="font-semibold">EXACTLY</span> the same as what is displayed on your device
          and then hit «<span class="font-semibold">Approve</span>»
        </p>
      </div>
    </div>
    <div class="my-auto flex-grow text-gray-600" v-if="loadingText">
      <loading-indicator type="circular" class="w-20 h-20 m-auto !block" />
      <p class="text-center pt-3">{{ loadingText }}</p>
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
      loadingText: "",
      pk: { publicKey: "", chainCode: "" }
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
      this.loadingText = "Waiting for device confirmation...";
      const app = new ErgoLedgerApp(await HidTransport.create());

      try {
        const pk = await app.getExtendedPublicKey("m/44'/429'/0'");
        // this.publicKey = pk.chainCodeHex + pk.publicKeyHex;

        const bip32 = Bip32.fromPublicKey(
          { publicKey: pk.publicKey, chainCode: pk.chainCode },
          "0"
        );

        this.publicKey = bip32.extendedPublicKey.toString("hex");

        this.loadingText = "Waiting for address confirmation...";
        this.confirmAddress = bip32.deriveAddress(0).script;
        if (!(await app.showAddress(DERIVATION_PATH + "/0"))) {
          this.loading = false;
          this.loadingText = "";
          this.confirmAddress = "";
          this.publicKey = "";
          return;
        }
      } finally {
        app.transport.close();
      }

      this.confirmAddress = "";
      this.loadingText = "Syncing...";

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
