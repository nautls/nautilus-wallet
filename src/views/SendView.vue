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
          :label="index === 0 ? 'Assets' : ''"
          v-for="(item, index) in selected"
          :key="item.asset.tokenId"
          v-model="item.amount"
          :asset="item.asset"
          :reserved-amount="isErg(item.asset.tokenId) ? reservedErgAmount : undefined"
          :min-amount="isErg(item.asset.tokenId) ? minBoxValue : undefined"
          :disposable="!isErg(item.asset.tokenId)"
          @remove="remove(item.asset.tokenId)"
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
      </div>
    </div>

    <fee-selector v-model:selected="babelFee" />

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
import { decimalize } from "@/utils/bigNumbers";
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

      for (const asset of this.selected.filter((a) => a.asset.tokenId !== ERG_TOKEN_ID)) {
        if (!asset.amount || !asset.amount.isEqualTo(asset.asset.confirmedAmount)) {
          return true;
        }
      }

      return false;
    },
    reservedErgAmount(): BigNumberType {
      const erg = find(this.selected, (a) => a.asset.tokenId === ERG_TOKEN_ID);
      if (!erg || erg.asset.confirmedAmount.isZero()) {
        return new BigNumber(0);
      }

      if (!this.changeValue) {
        return this.fee;
      }

      return this.fee.plus(this.changeValue);
    },
    fee(): BigNumberType {
      return this.babelFee.value;
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
    }
  },
  data() {
    return {
      selected: [] as TxAssetAmount[],
      transaction: undefined as Readonly<UnsignedTx> | undefined,
      babelFee: {
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
      }
    };
  },
  methods: {
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
        const boxes = await fetchBoxes(this.currentWallet.id);
        const [bestBlock] = await explorerService.getBlockHeaders({ limit: 1 });
        if (!bestBlock) {
          throw Error("Unable to fetch current height, please check your connection.");
        }

        const unsignedTx = new TxBuilder(deriver)
          .to(this.recipient)
          .inputs(boxes)
          .assets(this.selected as TxAssetAmount[])
          .fee(this.fee)
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
      const erg = find(this.assets, (a) => a.tokenId === ERG_TOKEN_ID);
      if (erg) {
        this.selected.push({ asset: erg, amount: undefined });
      }
    },
    urlForTransaction(txId: string): string {
      return `${TRANSACTION_URL}${txId}`;
    },
    add(asset: StateAsset) {
      this.selected.push({ asset });
      this.setMinBoxValue();
    },
    remove(tokenId: string) {
      remove(this.selected, (a) => a.asset.tokenId === tokenId);
      this.setMinBoxValue();
    },
    setMinBoxValue() {
      if (this.selected.length === 1) {
        return;
      }

      const erg = find(this.selected, (a) => this.isErg(a.asset.tokenId));
      if (!erg) {
        return;
      }

      if (!erg.amount || erg.amount.isLessThan(this.minBoxValue)) {
        erg.amount = new BigNumber(this.minBoxValue);
      }
    },
    isErg(tokenId: string): boolean {
      return tokenId === ERG_TOKEN_ID;
    }
  }
});
</script>
