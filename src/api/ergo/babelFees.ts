import { TOKEN_ID_LENGTH } from "@/constants/ergo";
import { ErgoBox } from "@/types/connector";
import { BigNumberType } from "@/types/internal";
import { wasmModule } from "@/utils/wasm-module";
import BigNumber from "bignumber.js";
import { isEmpty, sortBy } from "lodash";
import { graphQLService } from "../explorer/graphQlService";
import { addressFromErgoTree } from "./addresses";

const BABEL_ERGOTREE_PREFIX = "100604000e20";
const BABEL_ERGOTREE_SUFFIX =
  "0400040005000500d803d601e30004d602e4c6a70408d603e4c6a7050595e67201d804d604b2a5e4720100d605b2db63087204730000d606db6308a7d60799c1a7c17204d1968302019683050193c27204c2a7938c720501730193e4c672040408720293e4c672040505720393e4c67204060ec5a796830201929c998c7205029591b1720673028cb272067303000273047203720792720773057202";

export function buildBabelContractFor(tokenId: string): string {
  return `${BABEL_ERGOTREE_PREFIX}${tokenId}${BABEL_ERGOTREE_SUFFIX}`;
}

export function isBabelContract(ergoTree: string): boolean {
  return ergoTree.startsWith(BABEL_ERGOTREE_PREFIX) && ergoTree.endsWith(BABEL_ERGOTREE_SUFFIX);
}

export function isValidBabelBox(box: ErgoBox): boolean {
  return (
    !isEmpty(box.additionalRegisters?.R4) &&
    !isEmpty(box.additionalRegisters?.R5) &&
    !isEmpty(box.additionalRegisters?.R6)
  );
}

export function isBabelContractForTokenId(ergoTree: string, tokenId: string) {
  return extractTokenIdFromBabelContract(ergoTree) === tokenId;
}

export function extractTokenIdFromBabelContract(ergoTree: string): string {
  return ergoTree.slice(
    BABEL_ERGOTREE_PREFIX.length,
    BABEL_ERGOTREE_PREFIX.length + TOKEN_ID_LENGTH
  );
}

export function getNanoErgsPerTokenRate(box: ErgoBox): BigNumber {
  return new BigNumber(
    wasmModule.SigmaRust.Constant.decode_from_base16(box.additionalRegisters.R5).to_i64().to_str()
  );
}

export async function fetchBabelBoxes(tokenId: string, price?: BigNumber): Promise<ErgoBox[]> {
  const p2sAddress = addressFromErgoTree(buildBabelContractFor(tokenId));

  let boxes = filterValidBabelBoxes(await graphQLService.getMempoolBoxes(p2sAddress));
  boxes = boxes.filter((box) => !boxes.some((x) => x.additionalRegisters.R6.endsWith(box.boxId)));

  if (isEmpty(boxes)) {
    boxes = filterValidBabelBoxes(await graphQLService.getUnspentBoxes([p2sAddress]));
  }

  if (price) {
    boxes = filterByPrice(boxes, price);
  }

  return sortBy(boxes, (box) => box.creationHeight);
}

function filterByPrice(boxes: ErgoBox[], price: BigNumber): ErgoBox[] {
  return boxes.filter((box) => getNanoErgsPerTokenRate(box).isGreaterThanOrEqualTo(price));
}

function filterValidBabelBoxes(boxes: ErgoBox[]): ErgoBox[] {
  if (isEmpty(boxes)) {
    return boxes;
  }

  return boxes.filter((box) => isValidBabelBox(box));
}

/**
 * select a box with enough ERG balance
 *
 * @param boxes Unspent babel boxes
 * @param amount Undecimalized amount
 * @returns
 */
export function selectBestBabelBox(boxes: ErgoBox[], amount: BigNumberType): ErgoBox | undefined {
  return boxes.find((box) =>
    amount.multipliedBy(getNanoErgsPerTokenRate(box)).isLessThanOrEqualTo(box.value)
  );
}
