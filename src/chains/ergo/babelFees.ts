import { BabelBox, buildBabelContract, isValidBabelBox } from "@fleet-sdk/babel-fees-plugin";
import { Box, first } from "@fleet-sdk/common";
import { SAFE_MIN_BOX_VALUE } from "@fleet-sdk/core";
import { sortBy } from "es-toolkit";
import { graphQLService } from "@/chains/ergo/services/graphQlService";
import { BigNumber, bn } from "@/common/bigNumber";
import { safeSigmaDecode } from "./serialization";

const MIN_BABEL_BOX_VALUE = bn(SAFE_MIN_BOX_VALUE.toString());

export function getNanoErgsPerTokenRate(box: Box): BigNumber {
  const r = safeSigmaDecode<bigint>(box.additionalRegisters.R5);
  if (r?.type.toString() !== "SLong") throw new Error("Invalid babel box");
  return bn(r.data.toString());
}

export async function fetchBabelBoxes(tokenIds: string[], price = bn(0)): Promise<BabelBox[]> {
  const boxes = await graphQLService.getBoxes({
    from: "blockchain+mempool",
    where: { ergoTrees: tokenIds.map(buildBabelContract) }
  });
  const babelBoxes = boxes.filter(
    (box) =>
      isValidBabelBox(box) &&
      isPriceAcceptable(box, price) &&
      !boxes.some((x) => x.additionalRegisters.R6?.endsWith(box.boxId))
  ) as BabelBox[];

  return sortBy(babelBoxes, [(box) => box.creationHeight]);
}

function isPriceAcceptable(box: BabelBox, price: BigNumber): boolean {
  const rate = getNanoErgsPerTokenRate(box);
  return rate.gt(0) && rate.gte(price);
}

export function hasSufficientLiquidity(box: BabelBox, tokenUnits: BigNumber): boolean {
  const rate = getNanoErgsPerTokenRate(box);
  if (rate.lte(0) || tokenUnits.lte(0)) return false;

  return tokenUnits.times(rate).plus(MIN_BABEL_BOX_VALUE).lte(box.value.toString());
}

export function canCoverNanoErgs(box: BabelBox, nanoErgs: BigNumber): boolean {
  const rate = getNanoErgsPerTokenRate(box);
  if (rate.lte(0) || nanoErgs.lte(0)) return false;

  const tokenUnits = nanoErgs.div(rate).integerValue(BigNumber.ROUND_UP);
  return hasSufficientLiquidity(box, tokenUnits);
}

/**
 * select a box with enough ERG balance and best rate
 *
 * @param boxes Unspent babel boxes
 * @param amount Undecimalized amount
 * @returns
 */
export function selectBestBabelBox(boxes: BabelBox[], amount: BigNumber): BabelBox | undefined {
  return first(
    boxes
      .filter((box) => hasSufficientLiquidity(box, amount))
      .sort((a, b) => getNanoErgsPerTokenRate(b).comparedTo(getNanoErgsPerTokenRate(a)) ?? 0)
  );
}
