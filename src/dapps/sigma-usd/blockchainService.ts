import { AgeUSDBankBox, OracleBox, SIGMA_USD_PARAMETERS } from "@fleet-sdk/ageusd-plugin";
import { BoxSource } from "@fleet-sdk/blockchain-providers";
import { Amount, Box } from "@fleet-sdk/common";
import { graphQLService } from "@/chains/ergo/services/graphQlService";

export async function getBankBox(
  from: BoxSource = "blockchain+mempool"
): Promise<AgeUSDBankBox | undefined> {
  const boxes = await graphQLService.getBoxes({
    where: { ergoTree: SIGMA_USD_PARAMETERS.contract },
    from
  });

  return boxes.find(validBankBox) as AgeUSDBankBox;
}

export async function getOracleBox(
  from: BoxSource = "blockchain+mempool"
): Promise<OracleBox | undefined> {
  const boxes = await graphQLService.getBoxes({
    where: { tokenId: SIGMA_USD_PARAMETERS.oracle.nftId },
    from
  });

  if (!boxes.length) return;
  return boxes[0] as OracleBox;
}

function validBankBox(box: Box<Amount>): box is AgeUSDBankBox {
  return (
    box.assets.length === 3 &&
    SIGMA_USD_PARAMETERS.contract === box.ergoTree &&
    box.assets[0].tokenId === SIGMA_USD_PARAMETERS.tokens.stableCoinId &&
    box.assets[1].tokenId === SIGMA_USD_PARAMETERS.tokens.reserveCoinId &&
    box.assets[2].tokenId === SIGMA_USD_PARAMETERS.tokens.nftId
  );
}
