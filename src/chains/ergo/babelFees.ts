import { BabelBox, buildBabelContract, isValidBabelBox } from "@fleet-sdk/babel-fees-plugin";
import { Box, first } from "@fleet-sdk/common";
import { BigNumber } from "bignumber.js";
import { orderBy, sortBy } from "lodash-es";
import { graphQLService } from "@/chains/ergo/services/graphQlService";
import { bn } from "@/common/bigNumber";
import { safeSigmaDecode } from "./serialization";

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

  return sortBy(babelBoxes, (box) => box.creationHeight);
}

function isPriceAcceptable(box: BabelBox, price: BigNumber): boolean {
  return getNanoErgsPerTokenRate(box).gte(price);
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
    orderBy(
      boxes.filter((box) => amount.times(getNanoErgsPerTokenRate(box)).lte(box.value.toString())),
      (box) => getNanoErgsPerTokenRate(box)
    ).reverse()
  );
}
