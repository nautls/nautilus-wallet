import { TOKEN_ID_LENGTH } from "@/constants/ergo";
import { ErgoBox } from "@/types/connector";
import { BigNumberType } from "@/types/internal";
import { wasmModule } from "@/utils/wasm-module";
import BigNumber from "bignumber.js";
import { isEmpty, sortBy } from "lodash";
import { graphQLService } from "../explorer/graphQlService";
import { addressFromErgoTree } from "./addresses";

const BABEL_ERGOTREE_PREFIX = "1008040404000e20";
const BABEL_ERGOTREE_SUFFIX =
  "04000400040005000500d804d601e4c6a70408d602b2a599b1a5730000d603db6308a7d60499c1a7c17202eb027201d1ededededed93c27202c2a793e4c672020408720193e4c672020505e4c6a70505938cb2db63087202730100017302929c998cb2db63087202730300029591b1720373048cb27203730500027306e4c6a7050572049272047307";

export function buildBabelErgoTreeFor(tokenId: string): string {
  return `${BABEL_ERGOTREE_PREFIX}${tokenId}${BABEL_ERGOTREE_SUFFIX}`;
}

export function isBabelErgoTree(ergoTree: string): boolean {
  return ergoTree.startsWith(BABEL_ERGOTREE_PREFIX) && ergoTree.endsWith(BABEL_ERGOTREE_SUFFIX);
}

export function isValidBabelBox(box: ErgoBox): boolean {
  return !isEmpty(box.additionalRegisters?.R4) && !isEmpty(box.additionalRegisters?.R5);
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
  const response = await graphQLService.getUnspentBoxes([
    addressFromErgoTree(buildBabelErgoTreeFor(tokenId))
  ]);

  const boxes = response.filter((box) => isValidBabelBox(box));

  if (price) {
    return boxes.filter((box) => getNanoErgsPerTokenRate(box).isGreaterThanOrEqualTo(price));
  }

  return sortBy(boxes, (box) => box.creationHeight);
}

/**
 * select a box with enough ERG balance
 *
 * @param boxes Unspent babel boxes
 * @param amount Undecimalized amount
 * @returns
 */
export function selectOneBoxFrom(boxes: ErgoBox[], amount: BigNumberType): ErgoBox | undefined {
  return boxes.find((box) =>
    amount.multipliedBy(getNanoErgsPerTokenRate(box)).isLessThanOrEqualTo(box.value)
  );
}
