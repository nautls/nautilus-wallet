<template>
  <h1>Summary of the transaction:</h1>
  <p>You get:</p>
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
import BigNumber from "bignumber.js";
import { addressFromErgoTree } from "@/api/ergo/addresses";

export default defineComponent({
  name: "TxSignSummary",
  components: { TxBoxDetails },
  props: {
    tx: { type: Object as PropType<Readonly<TxInterpreter>>, required: true },
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
      const inputsAssets = this.mergeInputsTokens(this.thisWalletInputs);
      const outputsAssets = this.mergeOutputsTokens(this.thisWalletOutputs);
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
    mergeInputsTokens(inputs: UnsignedInput[]): Token[] {
      const mergedInputsAssets = inputs.reduce((acc: Token[], i: UnsignedInput) => {
        return acc.concat(i.assets);
      }, []);
      return this.accumTokens(mergedInputsAssets);
    },
    mergeOutputsTokens(outputs: ErgoBoxCandidate[]): Token[] {
      const mergedOutputsAssets = outputs.reduce((acc: Token[], o: ErgoBoxCandidate) => {
        return acc.concat(o.assets);
      }, []);
      return this.accumTokens(mergedOutputsAssets);
    },
    // The caller has to make sure that there are no duplicate tokenIds in a and b
    subtractAssets(a: Token[], b: Token[]): { tokensAGets: Token[]; tokensALoses: Token[] } {
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
        return {
          tokenId: t.tokenId,
          amount: new BigNumber(t.amount),
          name: t.name,
          decimals: t.decimals
        } as OutputAsset;
      });
    }
  }
});
</script>
