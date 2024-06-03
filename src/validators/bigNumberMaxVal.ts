import { BigNumberType } from "@/types/internal";
import { filters } from "@/common/globalFilters";

function validator(max: BigNumberType) {
  return (value?: BigNumberType) => {
    if (!value) {
      return true;
    }

    return !value.isGreaterThan(max);
  };
}

export default function (max: BigNumberType) {
  return {
    $validator: validator(max),
    $message: ({ $params }: any) =>
      `The amount should be less than or equal to ${filters.formatBigNumber($params.max)}`,
    $params: { max, type: "maxValue" }
  };
}
