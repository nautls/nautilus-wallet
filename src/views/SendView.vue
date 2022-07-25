<template>
  <div class="flex flex-col gap-4 min-h-full">
    <label>
      Receiver
      <input
        type="text"
        @blur="v$.recipient.$touch()"
        v-model.lazy="recipient"
        spellcheck="false"
        class="w-full control block"
      />
      <p class="input-error" v-if="v$.recipient.$error">{{ v$.recipient.$errors[0].$message }}</p>
    </label>
    <div>
      <div class="flex flex-col gap-2">
        <asset-input
          v-for="(item, index) in selected"
          :key="item.asset.tokenId"
          :label="index === 0 ? 'Assets' : ''"
          :asset="item.asset"
          :reserved-amount="getReserveAmountFor(item.asset.tokenId)"
          :min-amount="isErg(item.asset.tokenId) ? minBoxValue : undefined"
          :disposable="!isErg(item.asset.tokenId) || !(isErg(item.asset.tokenId) && isFeeInErg)"
          @remove="remove(item.asset.tokenId)"
          v-model="item.amount"
        />
        <drop-down
          :disabled="unselected.length === 0"
          list-class="max-h-50"
          trigger-class="px-2 py-3 text-sm uppercase "
        >
          <template v-slot:trigger>
            <div class="flex-grow pl-6 text-center font-bold">Add asset</div>
            <vue-feather type="chevron-down" size="18" />
          </template>
          <template v-slot:items>
            <div class="group">
              <a
                @click="add(asset)"
                class="group-item narrow"
                v-for="asset in unselected"
                :key="asset.tokenId"
              >
                <div class="flex flex-row items-center gap-2">
                  <asset-icon class="h-8 w-8" :token-id="asset.tokenId" :type="asset.info?.type" />
                  <div class="flex-grow">
                    <template v-if="asset.info?.name">{{
                      $filters.compactString(asset.info?.name, 26)
                    }}</template>
                    <template v-else>{{ $filters.compactString(asset.tokenId, 10) }}</template>
                  </div>
                  <div>{{ $filters.formatBigNumber(asset.confirmedAmount) }}</div>
                </div>
              </a>
            </div>
          </template>
        </drop-down>
        <p class="input-error" v-if="v$.selected.$error">{{ v$.selected.$errors[0].$message }}</p>
      </div>
    </div>

    <fee-selector v-model:selected="feeSettings" :include-min-amount-per-box="hasChange ? 1 : 0" />

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
import { defineComponent, Ref } from "vue";
import { GETTERS } from "@/constants/store/getters";
import { ERG_DECIMALS, ERG_TOKEN_ID, MIN_BOX_VALUE, SAFE_MIN_FEE_VALUE } from "@/constants/ergo";
import { AddressState, BigNumberType, FeeSettings, StateAsset, WalletType } from "@/types/internal";
import { differenceBy, find, isEmpty, remove } from "lodash";
import { ACTIONS } from "@/constants/store";
import { decimalize, undecimalize } from "@/utils/bigNumbers";
import { required, helpers } from "@vuelidate/validators";
import { useVuelidate, Validation, ValidationArgs } from "@vuelidate/core";
import { validErgoAddress } from "@/validators";
import { TRANSACTION_URL } from "@/constants/explorer";
import { ErgoTx, UnsignedTx } from "@/types/connector";
import { bip32Pool } from "@/utils/objectPool";
import { fetchBoxes } from "@/api/ergo/boxFetcher";
import { explorerService } from "@/api/explorer/explorerService";
import { TxAssetAmount, TxBuilder } from "@/api/ergo/transaction/txBuilder";
import { TxInterpreter } from "@/api/ergo/transaction/interpreter/txInterpreter";
import { submitTx } from "@/api/ergo/submitTx";
import { AxiosError } from "axios";
import BigNumber from "bignumber.js";
import AssetInput from "@/components/AssetInput.vue";
import LoadingModal from "@/components/LoadingModal.vue";
import LedgerSigningModal from "@/components/LedgerSigningModal.vue";
import TxSignModal from "@/components/TxSignModal.vue";
import FeeSelector from "@/components/FeeSelector.vue";
import { fetchBabelBoxes, selectOneBoxFrom } from "@/api/ergo/babelFees";

export default defineComponent({
  name: "SendView",
  components: { AssetInput, LoadingModal, LedgerSigningModal, TxSignModal, FeeSelector },
  setup() {
    return { v$: useVuelidate() as Ref<Validation<ValidationArgs<any>, unknown>> };
  },
  created() {
    if (this.$route.query.recipient) {
      this.recipient = this.$route.query.recipient as string;
    }
  },
  computed: {
    currentWallet() {
      return this.$store.state.currentWallet;
    },
    isLedger(): boolean {
      return this.currentWallet.type === WalletType.Ledger;
    },
    assets(): StateAsset[] {
      return this.$store.getters[GETTERS.BALANCE];
    },
    unselected(): StateAsset[] {
      return differenceBy(
        this.assets,
        this.selected.map((a) => a.asset),
        (a) => a.tokenId
      );
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
    isFeeInErg() {
      return this.isErg(this.feeSettings.tokenId);
    },
    changeValue(): BigNumberType | undefined {
      if (!this.hasChange) {
        return;
      }

      return this.minBoxValue;
    },
    minBoxValue(): BigNumberType {
      return decimalize(new BigNumber(MIN_BOX_VALUE), ERG_DECIMALS) || new BigNumber(0);
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
    feeSettings(newVal: FeeSettings) {
      if (this.isErg(newVal.tokenId)) {
        this.setErgAsSelected();
      }
    },
    ["selected.length"]() {
      this.v$.selected.$touch();
    }
  },
  data() {
    return {
      selected: [] as TxAssetAmount[],
      transaction: undefined as Readonly<UnsignedTx> | undefined,
      feeSettings: {
        tokenId: ERG_TOKEN_ID,
        value: decimalize(new BigNumber(SAFE_MIN_FEE_VALUE), ERG_DECIMALS)
      } as FeeSettings,
      signModalActive: false,
      password: "",
      recipient: "",
      stateMessage: "",
      state: "unknown"
    };
  },
  validations() {
    return {
      recipient: {
        required: helpers.withMessage("Receiver address is required.", required),
        validErgoAddress
      },
      selected: {
        required: helpers.withMessage(
          "At least one asset should be selected in order to send a transaction.",
          required
        )
      }
    };
  },
  methods: {
    getReserveAmountFor(tokenId: string): BigNumberType | undefined {
      if (this.isFeeAsset(tokenId)) {
        return this.reservedFeeAssetAmount;
      } else if (this.isErg(tokenId) && this.hasChange) {
        return this.changeValue;
      }
    },
    async buildTx() {
      this.transaction = undefined;

      const isValid = await this.v$.$validate();
      if (!isValid) {
        return;
      }

      this.state = "loading";
      this.stateMessage = "Loading context data...";

      if (this.currentWallet.settings.avoidAddressReuse) {
        const unused = find(
          this.$store.state.currentAddresses,
          (a) => a.state === AddressState.Unused && a.script !== this.recipient
        );
        if (!unused) {
          await this.$store.dispatch(ACTIONS.NEW_ADDRESS);
        }
      }

      const addresses = this.$store.state.currentAddresses;
      const deriver = bip32Pool.get(this.currentWallet.publicKey);
      const changeIndex = this.currentWallet.settings.avoidAddressReuse
        ? find(addresses, (a) => a.state === AddressState.Unused && a.script !== this.recipient)
            ?.index ?? this.currentWallet.settings.defaultChangeIndex
        : this.currentWallet.settings.defaultChangeIndex;

      try {
        const [boxes, [bestBlock]] = await Promise.all([
          await fetchBoxes(this.currentWallet.id),
          await explorerService.getBlockHeaders({ limit: 1 })
        ]);

        if (!bestBlock) {
          throw Error("Unable to fetch current height, please check your connection.");
        }

        if (this.feeSettings.tokenId !== ERG_TOKEN_ID) {
          const babelBoxes = await fetchBabelBoxes(this.feeSettings.tokenId);
          const selectedBox = selectOneBoxFrom(
            babelBoxes,
            undecimalize(this.feeSettings.value, this.feeSettings.assetInfo?.decimals || 0)
          );

          if (!selectedBox) {
            throw Error(
              "There is not enough liquidity in the Babel Boxes for the selected fee asset."
            );
          }

          this.feeSettings.box = selectedBox;
        }

        const unsignedTx = new TxBuilder(deriver)
          .to(this.recipient)
          .inputs(boxes)
          .assets(this.selected as TxAssetAmount[])
          .fee(this.feeSettings)
          .height(bestBlock.height)
          .changeIndex(changeIndex ?? 0)
          .build();

        const parsedTx = new TxInterpreter(
          unsignedTx,
          addresses.map((a) => a.script),
          this.$store.state.assetInfo
        );

        if (!isEmpty(parsedTx.burning)) {
          this.state = "error";
          this.stateMessage =
            "Malformed transaction. This is happening due to a known issue with the transaction building library, a patch is on the way.";
          return;
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
      this.recipient = "";
      this.password = "";
      this.transaction = undefined;
      this.v$.$reset();
    },
    async onSuccess(signedTx: ErgoTx) {
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
      return `${TRANSACTION_URL}${txId}`;
    },
    add(asset: StateAsset) {
      this.removeFeeAssetIfDisposable();
      this.selected.push({ asset });

      if (this.feeSettings.tokenId == ERG_TOKEN_ID) {
        this.setMinBoxValue();
      }
    },
    remove(tokenId: string) {
      remove(this.selected, (a) => a.asset.tokenId === tokenId);
      this.setMinBoxValue();
    },
    setMinBoxValue() {
      if (this.selected.length === 1) {
        return;
      }

      const erg = find(this.selected, (a) => this.isFeeAsset(a.asset.tokenId));
      if (!erg) {
        return;
      }

      if (!erg.amount || erg.amount.isLessThan(this.minBoxValue)) {
        erg.amount = new BigNumber(this.minBoxValue);
      }
    },
    removeFeeAssetIfDisposable() {
      if (this.selected.length > 1 || this.feeSettings.tokenId === ERG_TOKEN_ID) {
        return;
      }

      const item = this.selected[0];
      if (!item) {
        return;
      }

      if (!item.amount || item.amount.isZero()) {
        this.remove(item.asset.tokenId);
      }
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
