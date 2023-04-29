<template>
  <tx-box-details :assets="thisWalletGets" :type="'success'">
    <p>Assets <strong>incoming</strong> to your wallet</p>
  </tx-box-details>
  <tx-box-details :assets="thisWalletLoses" :type="'danger'">
    <p>Assets <strong>leaving</strong> your wallet</p>
  </tx-box-details>
</template>

<script lang="ts">
import { defineComponent, PropType } from "vue";
import TxBoxDetails from "@/components/TxBoxDetails.vue";
import { TxInterpreter } from "@/api/ergo/transaction/interpreter/txInterpreter";
import { ErgoBoxCandidate, Token, UnsignedInput } from "@/types/connector";
import { OutputAsset } from "@/api/ergo/transaction/interpreter/outputInterpreter";
import { addressFromErgoTree } from "@/api/ergo/addresses";
import { StateAssetInfo } from "@/types/internal";
import { decimalize, toBigNumber } from "@/utils/bigNumbers";
import { ERG_DECIMALS, ERG_TOKEN_ID } from "@/constants/ergo";

export default defineComponent({
  name: "TxSignSummary",
  components: { TxBoxDetails },
  props: {
    tx: { type: Object as PropType<Readonly<TxInterpreter>>, required: true },
    assetInfo: { type: Object as PropType<Readonly<StateAssetInfo>>, required: true },
    ownAddresses: { type: Array as PropType<Readonly<string[]>>, required: true }
  },
  computed: {
    thisWalletOutputs() {
      return this.tx.rawTx.outputs.filter((o: ErgoBoxCandidate) => {
        return this.ownAddresses.includes(addressFromErgoTree(o.ergoTree));
      });
    },
    thisWalletInputs() {
      return this.tx.rawTx.inputs.filter((i: UnsignedInput) => {
        return this.ownAddresses.includes(addressFromErgoTree(i.ergoTree));
      });
    },
    thisWalletDelta() {
      const inputsAssets = this.mergeTokensInBoxes(this.thisWalletInputs);
      const outputsAssets = this.mergeTokensInBoxes(this.thisWalletOutputs);
      const { tokensAGets: thisWalletGets, tokensALoses: thisWalletLoses } = this.subtractAssets(
        outputsAssets,
        inputsAssets
      );
      return { thisWalletGets, thisWalletLoses };
    },
    thisWalletGets() {
      return this.tokensToOutputAssets(this.thisWalletDelta.thisWalletGets);
    },
    thisWalletLoses() {
      return this.tokensToOutputAssets(this.thisWalletDelta.thisWalletLoses);
    }
  },
  methods: {
    accumTokens(tokens: Token[]): Token[] {
      return tokens.reduce((acc: Token[], t: Token) => {
        const existingToken = acc.find((a: Token) => a.tokenId === t.tokenId);
        if (existingToken) {
          existingToken.amount = String(BigInt(existingToken.amount) + BigInt(t.amount));
        } else {
          acc.push(t);
        }
        return acc;
      }, []);
    },
    extractAssetsFromBox(box: UnsignedInput | ErgoBoxCandidate): Token[] {
      return box.assets.concat({
        tokenId: ERG_TOKEN_ID,
        amount: String(box.value),
        decimals: ERG_DECIMALS,
        name: "ERG"
      });
    },
    mergeTokensInBoxes(boxes: (UnsignedInput | ErgoBoxCandidate)[]): Token[] {
      const mergedOutputsAssets = boxes.reduce(
        (acc: Token[], box: UnsignedInput | ErgoBoxCandidate) => {
          return acc.concat(this.extractAssetsFromBox(box));
        },
        []
      );
      return this.accumTokens(mergedOutputsAssets);
    },
    // The caller has to make sure that there are no duplicate tokenIds in a and b (call mergeTokensInBoxes first).
    subtractAssets(a: Token[], b: Token[]): { tokensAGets: Token[]; tokensALoses: Token[] } {
      // Add A tokens and subtract B tokens in the same map. Then use +/- to differentiate between A's and B's deltas.
      const mergedTokensMap: { [tokenId: string]: Token } = {};
      a.forEach((t: Token) => {
        mergedTokensMap[t.tokenId] = { ...t };
      });
      b.forEach((t: Token) => {
        if (Object.prototype.hasOwnProperty.call(mergedTokensMap, t.tokenId)) {
          mergedTokensMap[t.tokenId].amount = String(
            BigInt(mergedTokensMap[t.tokenId].amount) - BigInt(t.amount)
          );
        } else {
          mergedTokensMap[t.tokenId] = {
            ...t,
            amount: String(-1n * BigInt(t.amount))
          };
        }
      });
      const mergedTokens = Object.keys(mergedTokensMap).map((tokenId) => mergedTokensMap[tokenId]);
      const tokensAGets = mergedTokens.filter((t: Token) => BigInt(t.amount) > 0n);
      const tokensALoses = mergedTokens
        .filter((t: Token) => BigInt(t.amount) < 0n)
        .map((t: Token) => {
          t.amount = String(BigInt(t.amount) * -1n);
          return t;
        });
      return {
        tokensAGets,
        tokensALoses
      };
    },
    tokensToOutputAssets(tokens: Token[]): OutputAsset[] {
      return tokens.map((t: Token) => {
        const decimals = this.assetInfo[t.tokenId]?.decimals ?? 0;
        return {
          tokenId: t.tokenId,
          amount: decimalize(toBigNumber(t.amount), decimals),
          name: this.assetInfo[t.tokenId]?.name,
          decimals: decimals
        } as OutputAsset;
      });
    }
  }
});
</script>
