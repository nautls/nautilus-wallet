import { MINER_FEE_TREE } from "@/constants/ergo";
import { UnsignedTx, ErgoBoxCandidate } from "@/types/connector";
import { Address } from "@coinbarn/ergo-ts";
import { differenceBy, find, isEmpty } from "lodash";

export class TxInterpreter {
  private _tx!: UnsignedTx;

  private _changeBox?: ErgoBoxCandidate;
  private _feeBox?: ErgoBoxCandidate;
  private _sendingBoxes!: ErgoBoxCandidate[];

  constructor(tx: UnsignedTx, ownAddresses: string[]) {
    this._tx = tx;

    this._feeBox = find(tx.outputs, (b) => b.ergoTree === MINER_FEE_TREE);
    this._changeBox = find(tx.outputs, (b) =>
      ownAddresses.includes(Address.fromErgoTree(b.ergoTree).address)
    );
    this._sendingBoxes = differenceBy(
      tx.outputs,
      [this._feeBox, this._changeBox],
      (b) => b?.ergoTree
    );

    if (isEmpty(this._sendingBoxes) && this._changeBox) {
      this._sendingBoxes.push(this._changeBox);
      this._changeBox = undefined;
    }
  }

  public get from(): string[] {
    return this._tx.inputs.map((b) => Address.fromErgoTree(b.ergoTree).address);
  }

  public get to(): string[] | undefined {
    return this._sendingBoxes?.map((b) => Address.fromErgoTree(b.ergoTree).address);
  }

  public get change(): ErgoBoxCandidate | undefined {
    return this._changeBox;
  }

  public get fee(): ErgoBoxCandidate | undefined {
    return this._feeBox;
  }

  public get sending(): ErgoBoxCandidate[] {
    return this._sendingBoxes;
  }
}
