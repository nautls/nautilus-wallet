import { ERG_TOKEN_ID, MAINNET_MINER_FEE_TREE } from "@/constants/ergo";
import { ErgoBoxCandidate, Token, UnsignedInput, UnsignedTx } from "@/types/connector";
import { StateAssetInfo } from "@/types/internal";
import { decimalize, sumBigNumberBy, toBigNumber } from "@/utils/bigNumbers";
import BigNumber from "bignumber.js";
import { difference, find, groupBy, isEmpty } from "lodash";
import { addressFromErgoTree } from "../../addresses";
import { isBabelContract } from "../../babelFees";
import { OutputAsset, OutputInterpreter } from "./outputInterpreter";
import { some, utxoSum, utxoSumResultDiff } from "@fleet-sdk/common";
import {
  tokensToOutputAssets,
  boxCandidateToBoxAmounts,
  tokenAmountToToken,
  sortByTokenId
} from "@/api/ergo/transaction/interpreter/utils";

function isMinerFeeContract(ergoTree: string) {
  return ergoTree === MAINNET_MINER_FEE_TREE;
}

export class TxInterpreter {
  private _tx!: UnsignedTx;

  private _changeBoxes: ErgoBoxCandidate[];
  private _feeBox?: ErgoBoxCandidate;
  private _sendingBoxes!: ErgoBoxCandidate[];
  private _assetInfo!: StateAssetInfo;
  private _addresses!: string[];
  private _burningBalance!: OutputAsset[];
  private _ownInputs!: UnsignedInput[];
  private _ownOutputs!: ErgoBoxCandidate[];
  private _totalIncoming!: OutputAsset[];
  private _totalLeaving!: OutputAsset[];

  constructor(tx: UnsignedTx, ownAddresses: string[], assetInfo: StateAssetInfo) {
    this._tx = tx;
    this._addresses = ownAddresses;
    this._assetInfo = assetInfo;
    this._feeBox = find(tx.outputs, (b) => isMinerFeeContract(b.ergoTree));

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
        isBabelContract(this._sendingBoxes[0].ergoTree) &&
        !isEmpty(this._sendingBoxes[0].assets)
      ) {
        this._sendingBoxes = [...this._sendingBoxes, ...this._changeBoxes];
        this._changeBoxes = [];
      }
    }

    this._calcBurningBalance();
  }

  public get rawTx(): UnsignedTx {
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
      return new OutputInterpreter(b, this._tx.inputs, this._assetInfo, this._addresses);
    });
  }

  public get burning(): OutputAsset[] | undefined {
    if (isEmpty(this._burningBalance)) {
      return;
    }

    return this._burningBalance;
  }

  public get fee(): OutputInterpreter | undefined {
    if (!this._feeBox) {
      return;
    }

    return new OutputInterpreter(this._feeBox, this._tx.inputs, this._assetInfo);
  }

  public get totalIncoming(): OutputAsset[] {
    return this._totalIncoming;
  }

  public get totalLeaving(): OutputAsset[] {
    return this._totalLeaving;
  }

  private _calcIncomingLeavingTotals() {
    const ownInputAssets = utxoSum(this._ownInputs.map(boxCandidateToBoxAmounts));
    const ownOutputAssets = utxoSum(this._ownOutputs.map(boxCandidateToBoxAmounts));
    ownInputAssets.nanoErgs = ownInputAssets.nanoErgs ?? 0n;
    ownOutputAssets.nanoErgs = ownOutputAssets.nanoErgs ?? 0n;

    // Set amounts of tokens that are in own inputs, but not on own outputs to 0 in outputs,
    // so utxoSumResultDiff will calculate delta correctly instead of ignoring those tokens
    const tokenIdsExclusiveToOwnInputs = difference(
      ownInputAssets.tokens.map((t) => t.tokenId),
      ownOutputAssets.tokens.map((t) => t.tokenId)
    );
    ownOutputAssets.tokens = ownOutputAssets.tokens.concat(
      tokenIdsExclusiveToOwnInputs.map((id) => ({ tokenId: id, amount: 0n }))
    );
    const outputsMinusInputs = utxoSumResultDiff(ownOutputAssets, ownInputAssets);

    // Handle non-ERG tokens
    const totalIncomingTokens = outputsMinusInputs.tokens
      .filter((t) => t.amount > 0n)
      .map((t) => tokenAmountToToken(t, this._assetInfo));
    const totalLeavingTokens = outputsMinusInputs.tokens
      .filter((t) => t.amount < 0n)
      .map((t) => tokenAmountToToken({ tokenId: t.tokenId, amount: -t.amount }, this._assetInfo));

    // Handle ERG
    if (outputsMinusInputs.nanoErgs !== 0n) {
      const ergToken = tokenAmountToToken(
        {
          tokenId: ERG_TOKEN_ID,
          amount:
            outputsMinusInputs.nanoErgs > 0n
              ? outputsMinusInputs.nanoErgs
              : -outputsMinusInputs.nanoErgs
        },
        this._assetInfo
      );

      if (outputsMinusInputs.nanoErgs > 0n) {
        totalIncomingTokens.push(ergToken);
      } else {
        totalLeavingTokens.push(ergToken);
      }
    }

    // Sort to make ERG first
    this._totalIncoming = tokensToOutputAssets(sortByTokenId(totalIncomingTokens), this._assetInfo);
    this._totalLeaving = tokensToOutputAssets(sortByTokenId(totalLeavingTokens), this._assetInfo);
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
        if (!inputTotals[key]) {
          continue;
        }
        inputTotals[key] = inputTotals[key].minus(outputTotals[key]);
      }
    }

    this._burningBalance = Object.keys(inputTotals)
      .map((key) => {
        return {
          tokenId: key,
          name: this._assetInfo[key]?.name,
          amount: this._assetInfo[key]?.decimals
            ? decimalize(inputTotals[key], this._assetInfo[key].decimals ?? 0)
            : inputTotals[key]
        };
      })
      .filter((x) => x.amount.isGreaterThan(0));
  }

  private _sumTokens(assets: Token[]) {
    if (isEmpty(assets)) {
      return;
    }

    const groups = groupBy(
      assets.map((x) => {
        return { tokenId: x.tokenId, amount: toBigNumber(x.amount) };
      }),
      (x) => x.tokenId
    );

    const totals: { [tokenId: string]: BigNumber } = {};
    for (const key in groups) {
      totals[key] = sumBigNumberBy(groups[key], (x) => x.amount);
    }

    return totals;
  }

  private _determineChangeBoxes(): ErgoBoxCandidate[] {
    if (isEmpty(this._ownInputs) || isEmpty(this._ownOutputs)) {
      return [];
    }

    const inputAssets = utxoSum(this._ownInputs);
    const outputAssets = utxoSum(this._ownOutputs);
    const diff = utxoSumResultDiff(inputAssets, outputAssets);

    // handle intrawallet transactions, in this case we consider change as
    // the own boxes before the fee box
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
      if (remainingInputErg < outputValue) {
        continue;
      }

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
