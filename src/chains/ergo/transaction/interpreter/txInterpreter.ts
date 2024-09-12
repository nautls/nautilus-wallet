import { BigNumber } from "bignumber.js";
import { groupBy } from "lodash-es";
import {
  EIP12UnsignedInput,
  EIP12UnsignedTransaction,
  isEmpty,
  some,
  utxoDiff,
  utxoSum
} from "@fleet-sdk/common";
import { isValidBabelContract } from "@fleet-sdk/babel-fees-plugin";
import { addressFromErgoTree } from "../../addresses";
import { OutputAsset, OutputInterpreter } from "./outputInterpreter";
import { ERG_TOKEN_ID, MAINNET_MINER_FEE_TREE } from "@/constants/ergo";
import { ErgoBoxCandidate, Token } from "@/types/connector";
import { AssetsMetadataMap } from "@/types/internal";
import { bn, decimalize, sumBy } from "@/common/bigNumber";
import {
  tokenAmountToToken,
  tokensToOutputAssets
} from "@/chains/ergo/transaction/interpreter/utils";

function isMinerFeeContract(ergoTree: string) {
  return ergoTree === MAINNET_MINER_FEE_TREE;
}

export class TxInterpreter {
  private _tx!: EIP12UnsignedTransaction;

  private _changeBoxes: ErgoBoxCandidate[];
  private _feeBox?: ErgoBoxCandidate;
  private _sendingBoxes!: ErgoBoxCandidate[];
  private _metadata!: AssetsMetadataMap;
  private _addresses!: string[];
  private _burningBalance!: OutputAsset[];
  private _ownInputs!: EIP12UnsignedInput[];
  private _ownOutputs!: ErgoBoxCandidate[];
  private _totalIncoming!: OutputAsset[];
  private _totalLeaving!: OutputAsset[];

  constructor(tx: EIP12UnsignedTransaction, ownAddresses: string[], metadata: AssetsMetadataMap) {
    this._tx = tx;
    this._addresses = ownAddresses;
    this._metadata = metadata;
    this._feeBox = tx.outputs.find((b) => isMinerFeeContract(b.ergoTree));

    const isOwnErgoTree = (tree: string) => this._addresses.includes(addressFromErgoTree(tree));
    const isSendingOutput = (output: ErgoBoxCandidate) =>
      output !== this._feeBox && !this._changeBoxes.includes(output);

    this._ownInputs = tx.inputs.filter((b) => isOwnErgoTree(b.ergoTree));
    this._ownOutputs = tx.outputs.filter((b) => isOwnErgoTree(b.ergoTree));
    this._changeBoxes = this._determineChangeBoxes();
    this._sendingBoxes = tx.outputs.filter(isSendingOutput);
    this._calcIncomingLeavingTotals();

    if (some(this._changeBoxes)) {
      if (isEmpty(this._sendingBoxes)) {
        this._sendingBoxes = this._changeBoxes;
        this._changeBoxes = [];
      } else if (
        this._sendingBoxes.length === 1 &&
        isValidBabelContract(this._sendingBoxes[0].ergoTree) &&
        !isEmpty(this._sendingBoxes[0].assets)
      ) {
        this._sendingBoxes = [...this._changeBoxes, ...this._sendingBoxes];
        this._changeBoxes = [];
      }
    }

    this._calcBurningBalance();
  }

  public get rawTx(): EIP12UnsignedTransaction {
    return this._tx;
  }

  public get from(): string[] {
    return this._tx.inputs.map((b) => addressFromErgoTree(b.ergoTree));
  }

  public get to(): string[] | undefined {
    return this._sendingBoxes?.map((b) => addressFromErgoTree(b.ergoTree));
  }

  public get change(): ErgoBoxCandidate[] {
    return this._changeBoxes;
  }

  public get sending(): OutputInterpreter[] | undefined {
    return this._sendingBoxes.map((b) => {
      return new OutputInterpreter(b, this._tx.inputs, this._metadata, this._addresses);
    });
  }

  public get burning(): OutputAsset[] | undefined {
    if (isEmpty(this._burningBalance)) return;
    return this._burningBalance;
  }

  public get fee(): OutputInterpreter | undefined {
    if (!this._feeBox) return;
    return new OutputInterpreter(this._feeBox, this._tx.inputs, this._metadata);
  }

  public get totalIncoming(): OutputAsset[] {
    return this._totalIncoming;
  }

  public get totalLeaving(): OutputAsset[] {
    return this._totalLeaving;
  }

  private _calcIncomingLeavingTotals() {
    const diff = utxoDiff(utxoSum(this._ownOutputs), utxoSum(this._ownInputs));

    // Handle tokens
    const totalIncoming = diff.tokens
      .filter((t) => t.amount > 0n)
      .map((t) => tokenAmountToToken(t, this._metadata));
    const totalLeaving = diff.tokens
      .filter((t) => t.amount < 0n)
      .map((t) => tokenAmountToToken({ tokenId: t.tokenId, amount: -t.amount }, this._metadata));

    // Handle ERG
    if (diff.nanoErgs !== 0n) {
      const ergToken = tokenAmountToToken(
        {
          tokenId: ERG_TOKEN_ID,
          amount: diff.nanoErgs > 0n ? diff.nanoErgs : -diff.nanoErgs
        },
        this._metadata
      );

      if (diff.nanoErgs > 0n) {
        totalIncoming.unshift(ergToken);
      } else {
        totalLeaving.unshift(ergToken);
      }
    }

    // Sort to make ERG first
    this._totalIncoming = tokensToOutputAssets(totalIncoming, this._metadata);
    this._totalLeaving = tokensToOutputAssets(totalLeaving, this._metadata);
  }

  private _calcBurningBalance() {
    const inputTotals = this._sumTokens(
      this._tx.inputs
        .filter((x) => x.assets)
        .map((x) => x.assets)
        .flat()
    );

    if (!inputTotals) {
      this._burningBalance = [];
      return;
    }

    const outputTotals = this._sumTokens(
      this._tx.outputs
        .filter((x) => x.assets)
        .map((x) => x.assets)
        .flat()
    );
    if (outputTotals) {
      for (const key in outputTotals) {
        if (!inputTotals[key]) continue;
        inputTotals[key] = inputTotals[key].minus(outputTotals[key]);
      }
    }

    this._burningBalance = Object.keys(inputTotals)
      .map((key) => {
        return {
          tokenId: key,
          name: this._metadata.get(key)?.name,
          amount: decimalize(inputTotals[key], this._metadata.get(key)?.decimals ?? 0)
        };
      })
      .filter((x) => x.amount.isGreaterThan(0));
  }

  private _sumTokens(assets: Token[]) {
    if (isEmpty(assets)) return;

    const groups = groupBy(
      assets.map((x) => {
        return { tokenId: x.tokenId, amount: bn(x.amount) };
      }),
      (x) => x.tokenId
    );

    const totals: { [tokenId: string]: BigNumber } = {};
    for (const key in groups) {
      totals[key] = sumBy(groups[key], (x) => x.amount);
    }

    return totals;
  }

  private _determineChangeBoxes(): ErgoBoxCandidate[] {
    if (isEmpty(this._ownInputs) || isEmpty(this._ownOutputs)) return [];

    const inputAssets = utxoSum(this._ownInputs);
    const outputAssets = utxoSum(this._ownOutputs);
    const diff = utxoDiff(inputAssets, outputAssets);

    // handle intrawallet transactions, in this case we consider change as
    // the own boxes after the fee box
    if (diff.nanoErgs <= BigInt(this._feeBox?.value || 0)) {
      const index = this._tx.outputs.findIndex((output) => isMinerFeeContract(output.ergoTree));

      if (index > -1 && index < this._tx.outputs.length) {
        const possiblyChange = this._tx.outputs.slice(index + 1);
        return this._ownOutputs.filter((output) => possiblyChange.includes(output));
      }

      return [];
    }

    // Start with a map containing all own input assets and greedily
    // subtract the amounts from own outputs when possible.
    // This will detect some subset of outputs that form a valid
    // set of own change boxes that is maximal in terms of inclusion.
    const remainingInputTokens = Object.fromEntries(
      inputAssets.tokens.map(({ tokenId, amount }) => [tokenId, amount])
    );
    let remainingInputErg = inputAssets.nanoErgs;

    const changeBoxes: ErgoBoxCandidate[] = [];
    for (const output of this._ownOutputs) {
      const outputValue = BigInt(output.value);
      if (remainingInputErg < outputValue) continue;

      const containsNonChangeAssets = !!output.assets.find(
        (token) =>
          !remainingInputTokens[token.tokenId] ||
          remainingInputTokens[token.tokenId] < BigInt(token.amount)
      );

      if (!containsNonChangeAssets) {
        remainingInputErg -= outputValue;
        for (const asset of output.assets) {
          remainingInputTokens[asset.tokenId] -= BigInt(asset.amount);
        }

        changeBoxes.push(output);
      }
    }

    return changeBoxes;
  }
}
