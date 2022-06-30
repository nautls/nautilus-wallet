import { MAINNET_MINER_FEE_TREE, TESTNET_MINER_FEE_TREE } from "@/constants/ergo";
import { UnsignedTx, ErgoBoxCandidate, Token } from "@/types/connector";
import { StateAssetInfo } from "@/types/internal";
import { decimalize, sumBigNumberBy, toBigNumber } from "@/utils/bigNumbers";
import BigNumber from "bignumber.js";
import { difference, find, findLast, groupBy, isEmpty } from "lodash";
import { addressFromErgoTree } from "../../addresses";
import { OutputAsset, OutputInterpreter } from "./outputInterpreter";

function isMinerFeeTree(ergoTree: string) {
  return ergoTree === MAINNET_MINER_FEE_TREE || ergoTree === TESTNET_MINER_FEE_TREE;
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
    this._feeBox = find(tx.outputs, (b) => isMinerFeeTree(b.ergoTree));

    if (find(tx.inputs, (i) => ownAddresses.includes(addressFromErgoTree(i.ergoTree)))) {
      this._changeBox = findLast(tx.outputs, (o) =>
        ownAddresses.includes(addressFromErgoTree(o.ergoTree))
      );
    }

    this._sendingBoxes = difference(tx.outputs, [this._feeBox, this._changeBox]).filter(
      (b) => b !== undefined
    ) as ErgoBoxCandidate[];

    if (isEmpty(this._sendingBoxes) && this._changeBox) {
      this._sendingBoxes.push(this._changeBox);
      this._changeBox = undefined;
    }

    this._calcBurningBalance();
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
    const inputTotals = this._sumTokens(this._tx.inputs.map((x) => x.assets).flat());
    if (!inputTotals) {
      this._burningBalance = [];
      return;
    }

    const outputTotals = this._sumTokens(this._tx.outputs.map((x) => x.assets).flat());
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
}
