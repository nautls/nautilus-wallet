import { filters } from "@/utils/globalFilters";
import BigNumber from "bignumber.js";

function validator(min: BigNumber) {
  return (value?: BigNumber) => {
    if (!value) {
      return true;
    }

    return !value.isLessThan(min);
  };
}

export default function (min: BigNumber) {
  return {
    $validator: validator(min),
    $message: ({ $params }: any) =>
      `The amount should be greater than or equal to ${filters.formatBigNumber($params.min)}`,
    $params: { min, type: "minValue" }
  };
}
