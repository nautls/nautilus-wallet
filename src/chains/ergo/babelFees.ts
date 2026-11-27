import { BabelBox, buildBabelContract, isValidBabelBox } from "@fleet-sdk/babel-fees-plugin";
import { Box, first } from "@fleet-sdk/common";
import { orderBy, sortBy } from "es-toolkit";
import { useRelayStore } from "@/stores/relayStore";
import { type BigNumber, bn } from "@/common/bigNumber";
import { safeSigmaDecode } from "./serialization";

export function getNanoErgsPerTokenRate(box: Box): BigNumber {
  const r = safeSigmaDecode<bigint>(box.additionalRegisters.R5);
  if (r?.type.toString() !== "SLong") throw new Error("Invalid babel box");
  return bn(r.data.toString());
}

/** The Babel contract's code, which every token's instance shares: the token id is a constant. */
const BABEL_TEMPLATE =
  "d803d601e30004d602e4c6a70408d603e4c6a7050595e67201d804d604b2a5e4720100d605b2db63087204730000d606db6308a7d60799c1a7c17204d1968302019683050193c27204c2a7938c720501730193e4c672040408720293e4c672040505720393e4c67204060ec5a796830201929c998c7205029591b1720673028cb272067303000273047203720792720773057202";

/** Unspent Babel boxes of the tokens, with the mempool applied. */
export async function fetchBabelBoxes(tokenIds: string[], price = bn(0)): Promise<BabelBox[]> {
  const contracts = new Set(tokenIds.map(buildBabelContract));
  const { spendable } = await useRelayStore().readBoxes({ template: BABEL_TEMPLATE });
  const babelBoxes = (spendable as Box[]).filter(
    (box): box is BabelBox =>
      contracts.has(box.ergoTree) && isValidBabelBox(box) && isPriceAcceptable(box, price)
  );

  return sortBy(babelBoxes, [(box) => box.creationHeight]);
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
      [(box) => getNanoErgsPerTokenRate(box)],
      ["desc"]
    )
  );
}
