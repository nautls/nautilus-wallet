import { filters } from "@/utils/globalFilters";
import BigNumber from "bignumber.js";

function validator(max: BigNumber) {
  return (value?: BigNumber) => {
    if (!value) {
      return true;
    }

    return !value.isGreaterThan(max);
  };
}

export default function (max: BigNumber) {
  return {
    $validator: validator(max),
    $message: ({ $params }: any) =>
      `The amount should be less than or equal to ${filters.formatBigNumber($params.max)}`,
    $params: { max, type: "maxValue" }
  };
}
