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
        <drop-down :disabled="unselected.length === 0">
          <template v-slot:trigger>
            <div class="text-sm w-full uppercase py-1 pl-6 text-center font-bold">Add asset</div>
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
                    <p
                      v-if="devMode && !isErg(asset.tokenId)"
                      class="text-gray-400 text-xs font-mono"
                    >
                      {{ $filters.compactString(asset.tokenId, 16) }}
                    </p>
                  </div>
                  <div>{{ $filters.formatBigNumber(asset.confirmedAmount) }}</div>
                </div>
              </a>
            </div>
            <div class="group">
              <a @click="addAll()" class="group-item narrow">
                <div class="flex flex-row items-center gap-2">
                  <mdi-icon name="check-all" class="text-yellow-500 w-8 h-8" size="32" />
                  <div class="flex-grow">
                    Add all
                    <p class="text-gray-400 text-xs">
                      Use this option to include all your assets in the sending list.
                    </p>
                  </div>
                </div>
              </a>
            </div>
          </template>
        </drop-down>
        <div class="w-full">
          <div class="w-auto float-right">
            <drop-down discrete>
              <template v-slot:trigger>
                <div class="text-sm w-full text-right py-1 text-center">
                  <span>Fee: {{ fee }} ERG</span>
                </div>
                <vue-feather type="chevron-down" size="18" />
              </template>
              <template v-slot:items>
                <div class="group">
                  <o-slider
                    v-model="feeMultiplier"
                    @click.prevent.stop
                    :min="1"
                    :max="5"
                    :tooltip="false"
                    fill-class="bg-blue-600 rounded-l"
                    root-class="p-4"
                    track-class="rounded-r"
                    thumb-class="rounded"
                  />
                </div>
              </template>
            </drop-down>
          </div>
        </div>
      </div>
    </div>
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
import { ERG_DECIMALS, ERG_TOKEN_ID, FEE_VALUE, MIN_BOX_VALUE } from "@/constants/ergo";
import { AddressState, StateAsset, WalletType } from "@/types/internal";
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
import { TxAssetAmount, TxBuilder } from "@/api/ergo/transaction/txBuilder";
import { TxInterpreter } from "@/api/ergo/transaction/interpreter/txInterpreter";
import { submitTx } from "@/api/ergo/submitTx";
import { AxiosError } from "axios";
import BigNumber from "bignumber.js";
import AssetInput from "@/components/AssetInput.vue";
import LoadingModal from "@/components/LoadingModal.vue";
import TxSignModal from "@/components/TxSignModal.vue";
import { graphQLService } from "@/api/explorer/graphQlService";
import { SignedTransaction } from "@ergo-graphql/types";

const validations = {
  recipient: {
    required: helpers.withMessage("Receiver address is required.", required),
    validErgoAddress
  }
};

export default defineComponent({
  name: "SendView",
  components: { AssetInput, LoadingModal, TxSignModal },
  setup() {
    return { v$: useVuelidate() as Ref<Validation<ValidationArgs<typeof validations>, unknown>> };
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
    reservedErgAmount(): BigNumber {
      const erg = find(this.selected, (a) => a.asset.tokenId === ERG_TOKEN_ID);
      if (!erg || erg.asset.confirmedAmount.isZero()) {
        return new BigNumber(0);
      }

      if (!this.changeValue) {
        return this.fee;
      }

      return this.fee.plus(this.changeValue);
    },
    fee(): BigNumber {
      return this.minFee.multipliedBy(this.feeMultiplier);
    },
    changeValue(): BigNumber | undefined {
      if (!this.hasChange) {
        return;
      }

      return this.minBoxValue;
    },
    minBoxValue(): BigNumber {
      return decimalize(new BigNumber(MIN_BOX_VALUE), ERG_DECIMALS) || new BigNumber(0);
    },
    devMode() {
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
    }
  },
  data() {
    return {
      selected: [] as TxAssetAmount[],
      transaction: undefined as Readonly<UnsignedTx> | undefined,
      signModalActive: false,
      password: "",
      recipient: "",
      feeMultiplier: 1,
      stateMessage: "",
      state: "unknown",
      minFee: Object.freeze(decimalize(new BigNumber(FEE_VALUE), ERG_DECIMALS))
    };
  },
  validations() {
    return validations;
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
        const [bestBlock] = await graphQLService.getBlockHeaders({ take: 1 });
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
    addAll() {
      this.unselected.forEach((unselected) => {
        this.selected.push({ asset: unselected });
      });

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
