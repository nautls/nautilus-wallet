<template>
  <div class="flex flex-col gap-5 h-full">
    <label>
      Receiver
      <input type="text" v-model.lazy="recipient" spellcheck="false" class="w-full control block" />
    </label>
    <div class="flex-grow">
      <div class="flex flex-col gap-2">
        <asset-input
          :label="index === 0 ? 'Assets' : ''"
          v-for="(item, index) in selected"
          :key="item.asset.tokenId"
          v-model="item.amount"
          :asset="item.asset"
          :disposable="!isErg(item.asset.tokenId)"
          @remove="remove(item.asset.tokenId)"
        />
        <p class="text-xs text-right">Fee: {{ suggestedFee }} ERG</p>
        <drop-down class="mt-3">
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
                  <img
                    :src="$filters.assetLogo(asset.tokenId)"
                    class="h-8 w-8 rounded-full"
                    :alt="asset.name"
                  />
                  <div class="flex-grow">
                    <template v-if="asset.name">{{
                      $filters.compactString(asset.name, 20, "end")
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

    <div class="flex-shrink">
      <div>
        <label
          >Password <input v-model.lazy="password" type="password" class="w-full control block"
        /></label>
      </div>
      <button class="btn w-full mt-5" @click="sendTx()">Confirm</button>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { GETTERS } from "@/constants/store/getters";
import { ERG_DECIMALS, ERG_TOKEN_ID, FEE_VALUE } from "@/constants/ergo";
import { SendTxCommandAsset, StateAsset } from "@/types/internal";
import AssetInput from "@/components/AssetInput.vue";
import { differenceBy, find, isEmpty, remove } from "lodash";
import { ACTIONS } from "@/constants/store";
import { wasmModule } from "@/utils/wasm-module";
import BigNumber from "bignumber.js";
import { setDecimals } from "@/utils/bigNumbers";

export default defineComponent({
  name: "SendView",
  components: { AssetInput },
  computed: {
    assets(): StateAsset[] {
      return this.$store.getters[GETTERS.BALANCE];
    },
    unselected(): StateAsset[] {
      return differenceBy(
        this.assets,
        this.selected.map(a => a.asset),
        a => a.tokenId
      );
    },
    suggestedFee(): string {
      return setDecimals(new BigNumber(FEE_VALUE), ERG_DECIMALS)?.toString() || "";
    }
  },
  watch: {
    assets: {
      immediate: true,
      handler() {
        if (!isEmpty(this.selected)) {
          return;
        }

        const erg = find(this.assets, a => a.tokenId === ERG_TOKEN_ID);
        if (erg) {
          this.selected.push({ asset: erg });
        }
      }
    }
  },
  data() {
    return {
      selected: [] as SendTxCommandAsset[],
      password: "",
      recipient: ""
    };
  },
  methods: {
    async sendTx() {
      const currentWalletId = this.$store.state.currentWallet.id;
      await this.$store.dispatch(ACTIONS.SEND_TX, {
        recipient: this.recipient,
        assets: this.selected,
        walletId: currentWalletId,
        password: this.password
      });
    },
    add(asset: StateAsset) {
      this.selected.push({ asset });
    },
    remove(tokenId: string) {
      remove(this.selected, a => a.asset.tokenId === tokenId);
    },
    isErg(tokenId: string): boolean {
      return tokenId === ERG_TOKEN_ID;
    }
  }
});
</script>
