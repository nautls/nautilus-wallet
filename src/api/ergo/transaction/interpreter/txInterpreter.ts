import { MAINNET_MINER_FEE_TREE } from "@/constants/ergo";
import { ErgoBoxCandidate, Token, UnsignedTx } from "@/types/connector";
import { StateAssetInfo } from "@/types/internal";
import { decimalize, sumBigNumberBy, toBigNumber } from "@/utils/bigNumbers";
import BigNumber from "bignumber.js";
import { difference, find, groupBy, isEmpty } from "lodash";
import { addressFromErgoTree } from "../../addresses";
import { isBabelContract } from "../../babelFees";
import { OutputAsset, OutputInterpreter } from "./outputInterpreter";

function isMinerFeeContract(ergoTree: string) {
  return ergoTree === MAINNET_MINER_FEE_TREE;
}

export class TxInterpreter {
  private _tx!: UnsignedTx;

  private _changeBox?: ErgoBoxCandidate;
  private _feeBox?: ErgoBoxCandidate;
  private _sendingBoxes!: ErgoBoxCandidate[];
  private _assetInfo!: StateAssetInfo;
  private _addresses!: string[];
  private _burningBalance!: OutputAsset[];

  constructor(tx: UnsignedTx, ownAddresses: string[], assetInfo: StateAssetInfo) {
    this._tx = tx;
    this._addresses = ownAddresses;
    this._assetInfo = assetInfo;
    this._feeBox = find(tx.outputs, (b) => isMinerFeeContract(b.ergoTree));

    this._determineChangeBox();

    this._sendingBoxes = difference(tx.outputs, [this._feeBox, this._changeBox]).filter(
      (b) => b !== undefined
    ) as ErgoBoxCandidate[];

    if (this._changeBox && this._sendingBoxes.length <= 1) {
      if (isEmpty(this._sendingBoxes)) {
        this._sendingBoxes.push(this._changeBox);
        this._changeBox = undefined;
      } else if (
        isBabelContract(this._sendingBoxes[0].ergoTree) &&
        !isEmpty(this._sendingBoxes[0].assets)
      ) {
        this._sendingBoxes.unshift(this._changeBox);
        this._changeBox = undefined;
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

  public get change(): ErgoBoxCandidate | undefined {
    return this._changeBox;
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

  // Find an output that only contains assets from own inputs in <= amounts
  // In case of multiwitness txs, change box can be different for each participant
  // In some cases, there can be no change box present as well
  private _determineChangeBox() {
    this._changeBox = undefined;

    const isOwnErgoTree = (tree: string) => this._addresses.includes(addressFromErgoTree(tree));

    const ownInputs = this._tx.inputs.filter((i) => isOwnErgoTree(i.ergoTree));
    const ownOutputsReversed = this._tx.outputs.filter((o) => isOwnErgoTree(o.ergoTree)).reverse();

    if (ownInputs.length === 0 || ownOutputsReversed.length === 0) {
      return;
    }

    const ownInputAssets = this._sumTokens(
      ownInputs
        .filter((x) => x.assets)
        .map((x) => x.assets)
        .flat()
    );
    if (!ownInputAssets) {
      return;
    }

    for (const o of ownOutputsReversed) {
      const nonChangeAssets = o.assets.filter((asset) => {
        return (
          ownInputAssets[asset.tokenId] === undefined ||
          ownInputAssets[asset.tokenId] < new BigNumber(asset.amount)
        );
      });
      if (nonChangeAssets.length === 0) {
        this._changeBox = o;
        return;
      }
    }
  }
}
