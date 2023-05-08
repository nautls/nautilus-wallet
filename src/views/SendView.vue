<template>
  <div class="flex flex-col gap-4 min-h-full">
    <div v-for="(recipient, idx) in recipients" v-bind:key="recipient.id">
      <div v-if="idx !== 0">
        <br />
        <hr />
        <br />
      </div>
      <recipient-form
        :disposable="recipients.length > 1"
        :get-reserve-amount-for="getReserveAmountFor"
        @removeRecipient="() => removeRecipient(recipient.id)"
        @update:recipientAddress="(recipientAddress: string) => { setRecipientAddress(recipient.id, recipientAddress) }"
        @update:selectedAssets="
          (selectedAssets) => {
            setRecipientAssets(recipient.id, selectedAssets);
          }
        "
      />
    </div>
    <div @click="addRecipient" class="cursor-pointer">
      + Add receiver
    </div>

    <fee-selector v-model:selected="feeSettings" :include-min-amount-per-box="!hasChange ? 0 : 1" />

    <div class="flex-grow"></div>
    <button class="btn w-full" @click="buildTx()">Confirm</button>
    <loading-modal
      title="Loading"
      :message="stateMessage"
      :state="state"
      @close="state = 'unknown'"
    />

    <tx-sign-modal
      @close="onClose"
      @fail="onFail"
      @refused="onRefused"
      @success="onSuccess"
      :active="signModalActive"
      :transaction="transaction"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { GETTERS } from "@/constants/store/getters";
import { ERG_DECIMALS, ERG_TOKEN_ID, MIN_BOX_VALUE, SAFE_MIN_FEE_VALUE } from "@/constants/ergo";
import { BigNumberType, FeeSettings, StateAsset, StateWallet, WalletType } from "@/types/internal";
import { differenceBy, find, isEmpty } from "lodash";
import { decimalize, undecimalize } from "@/utils/bigNumbers";
import { UnsignedTx } from "@/types/connector";
import { createP2PTransaction, TxAssetAmount } from "@/api/ergo/transaction/txBuilder";
import { TxInterpreter } from "@/api/ergo/transaction/interpreter/txInterpreter";
import { submitTx } from "@/api/ergo/submitTx";
import { AxiosError } from "axios";
import BigNumber from "bignumber.js";
import LoadingModal from "@/components/LoadingModal.vue";
import TxSignModal from "@/components/TxSignModal.vue";
import FeeSelector from "@/components/FeeSelector.vue";
import { SignedTransaction } from "@ergo-graphql/types";
import RecipientForm from "@/components/RecipientForm.vue";
import { Recipient } from "@/types/internal";

export default defineComponent({
  name: "SendView",
  components: { RecipientForm, LoadingModal, TxSignModal, FeeSelector },
  created() {
    if (this.$route.query.recipient && this.recipients.length > 0) {
      this.recipients[0].address = this.$route.query.recipient as string;
    }
  },
  computed: {
    currentWallet(): StateWallet {
      return this.$store.state.currentWallet;
    },
    isLedger(): boolean {
      return this.currentWallet.type === WalletType.Ledger;
    },
    assets(): StateAsset[] {
      return this.$store.getters[GETTERS.BALANCE];
    },
    // Aggregate amoung all recipients
    selected(): TxAssetAmount[] {
      const selectedAssetMap: { [tokenId: string]: { asset: StateAsset; amount: BigNumberType } } =
        {};
      for (const recipient of this.recipients) {
        recipient.selectedAssets.forEach((assetInfo) => {
          if (!Object.hasOwn(selectedAssetMap, assetInfo.asset.tokenId)) {
            selectedAssetMap[assetInfo.asset.tokenId] = {
              asset: assetInfo.asset,
              amount: new BigNumber(0)
            };
          }
          selectedAssetMap[assetInfo.asset.tokenId].amount = selectedAssetMap[
            assetInfo.asset.tokenId
          ].amount.plus(assetInfo.amount ?? 0);
        });
      }
      const selected = [] as TxAssetAmount[];
      for (const assetInfo of Object.values(selectedAssetMap)) {
        selected.push({
          asset: assetInfo.asset,
          amount: assetInfo.amount
        });
      }
      return selected;
    },
    unselected(): StateAsset[] {
      return differenceBy(
        this.assets,
        this.selected.map((a) => a.asset),
        (a) => a.tokenId
      );
    },
    hasMinErgSelected(): boolean {
      const erg = this.selected.find((x) => this.isErg(x.asset.tokenId));
      if (!erg || !erg.amount || erg.amount.isZero()) {
        return false;
      }

      return undecimalize(erg.amount, ERG_DECIMALS).isGreaterThanOrEqualTo(MIN_BOX_VALUE);
    },
    hasChange(): boolean {
      if (!isEmpty(this.unselected)) {
        return true;
      }

      for (const item of this.selected.filter((a) => a.asset.tokenId !== ERG_TOKEN_ID)) {
        if (
          !item.amount ||
          (!this.isFeeAsset(item.asset.tokenId) &&
            !item.amount.isEqualTo(item.asset.confirmedAmount)) ||
          (this.isFeeAsset(item.asset.tokenId) &&
            !item.amount.isEqualTo(item.asset.confirmedAmount.minus(this.fee)))
        ) {
          return true;
        }
      }

      return false;
    },
    reservedFeeAssetAmount(): BigNumberType {
      const feeAsset = find(this.selected, (a) => a.asset.tokenId === this.feeSettings.tokenId);
      if (!feeAsset || feeAsset.asset.confirmedAmount.isZero()) {
        return new BigNumber(0);
      }

      if (!this.changeValue) {
        return this.fee;
      }

      if (this.feeSettings.tokenId === ERG_TOKEN_ID) {
        return this.fee.plus(this.changeValue);
      }

      return this.fee;
    },
    fee(): BigNumberType {
      return this.feeSettings.value;
    },
    isFeeInErg(): boolean {
      return this.isErg(this.feeSettings.tokenId);
    },
    changeValue(): BigNumberType | undefined {
      if (!this.hasChange) {
        return;
      }

      return this.minBoxValue;
    },
    minBoxValue(): BigNumberType {
      return decimalize(new BigNumber(MIN_BOX_VALUE), ERG_DECIMALS);
    },
    devMode(): boolean {
      return this.$store.state.settings.devMode;
    }
  },
  watch: {
    currentWallet() {
      this.$router.push({ name: "assets-page" });
    },
    assets: {
      immediate: true,
      handler() {
        if (!isEmpty(this.selected)) {
          return;
        }

        this.setErgAsSelected();
      }
    },
    ["feeSettings.tokenId"](newVal: string) {
      if (this.isErg(newVal)) {
        this.setErgAsSelected();
      }
    }
  },
  data() {
    return {
      transaction: undefined as Readonly<UnsignedTx> | undefined,
      feeSettings: {
        tokenId: ERG_TOKEN_ID,
        value: decimalize(new BigNumber(SAFE_MIN_FEE_VALUE), ERG_DECIMALS)
      } as FeeSettings,
      signModalActive: false,
      password: "",
      recipients: [
        {
          id: 0,
          address: "",
          selectedAssets: []
        }
      ] as Recipient[],
      nextRecipientId: 1,
      stateMessage: "",
      state: "unknown"
    };
  },
  methods: {
    ensureRecipientExists(id: number) {
      if (!find(this.recipients, (r) => r.id === id)) {
        throw new Error("Invalid recipient index");
      }
    },
    addRecipient() {
      this.recipients.push({
        id: this.nextRecipientId,
        address: "",
        selectedAssets: []
      });
      this.nextRecipientId++;
    },
    setRecipientAddress(id: number, recipientAddress: string) {
      this.ensureRecipientExists(id);
      const idx = this.recipients.map((r) => r.id).indexOf(id);
      this.recipients.splice(idx, 1, { ...this.recipients[idx], address: recipientAddress });
    },
    setRecipientAssets(id: number, selectedAssets: TxAssetAmount[]) {
      this.ensureRecipientExists(id);
      const idx = this.recipients.map((r) => r.id).indexOf(id);
      this.recipients.splice(idx, 1, { ...this.recipients[idx], selectedAssets });
    },
    removeRecipient(id: number) {
      this.ensureRecipientExists(id);
      const idx = this.recipients.map((r) => r.id).indexOf(id);
      this.recipients.splice(idx, 1);
    },
    getReserveAmountFor(tokenId: string): BigNumberType | undefined {
      if (this.isFeeAsset(tokenId)) {
        return this.reservedFeeAssetAmount;
      } else if (this.isErg(tokenId) && this.hasChange) {
        return this.changeValue;
      }
    },
    async buildTx() {
      this.transaction = undefined;

      this.state = "loading";
      this.stateMessage = "Loading context data...";

      try {
        const unsignedTx = await createP2PTransaction({
          recipientsInfo: this.recipients.map((r) => ({
            address: r.address,
            assets: r.selectedAssets.map((a) => {
              return {
                asset: a.asset,
                amount: a.amount
              } as TxAssetAmount;
            })
          })),
          fee: this.feeSettings,
          walletType: this.currentWallet.type
        });

        const burning = new TxInterpreter(unsignedTx, [], this.$store.state.assetInfo).burning;
        if (!isEmpty(burning)) {
          throw new Error(
            "Malformed transaction. This is happening due to a known issue with the transaction building library, a patch is on the way."
          );
        }

        this.transaction = Object.freeze(unsignedTx);
        this.signModalActive = true;
      } catch (e) {
        this.state = "error";
        this.stateMessage = typeof e === "string" ? e : (e as Error).message;
        this.signModalActive = false;
      }
    },
    clear(): void {
      this.selected = [];
      this.setErgAsSelected();
      this.recipients = [
        {
          id: 0,
          address: "",
          selectedAssets: []
        }
      ];
      this.password = "";
      this.transaction = undefined;
    },
    async onSuccess(signedTx: SignedTransaction) {
      this.signModalActive = false;
      this.stateMessage = "Signed. Submitting transaction...";

      try {
        const txId = await submitTx(signedTx, this.currentWallet.id);
        this.state = "success";
        this.stateMessage = `Transaction submitted<br><a class='url' href='${this.urlForTransaction(
          txId
        )}' target='_blank'>View on Explorer</a>`;

        this.clear();
      } catch (e) {
        this.state = "error";

        if (e instanceof AxiosError) {
          this.stateMessage = e.message;
        } else {
          this.stateMessage = typeof e === "string" ? e : (e as Error).message;
        }
      }
    },
    onRefused() {
      this.state = "unknown";
      this.stateMessage = "";
      this.signModalActive = false;
    },
    onFail(info: string) {
      this.state = "error";
      this.stateMessage = info;
      this.signModalActive = false;
    },
    onClose() {
      this.state = "unknown";
      this.stateMessage = "";
      this.signModalActive = false;
    },
    setErgAsSelected(): void {
      if (!this.isFeeInErg && !isEmpty(this.selected)) {
        return;
      }

      const selected = find(this.selected, (a) => a.asset.tokenId === ERG_TOKEN_ID);
      if (selected) {
        return;
      }

      const erg = find(this.assets, (a) => a.tokenId === ERG_TOKEN_ID);
      if (erg) {
        this.selected.unshift({ asset: erg, amount: undefined });
      }
    },
    urlForTransaction(txId: string): string {
      return new URL(`/transactions/${txId}`, this.$store.state.settings.explorerUrl).toString();
    },
    isFeeAsset(tokenId: string): boolean {
      return tokenId === this.feeSettings.tokenId;
    },
    isErg(tokenId: string): boolean {
      return tokenId === ERG_TOKEN_ID;
    }
  }
});
</script>
