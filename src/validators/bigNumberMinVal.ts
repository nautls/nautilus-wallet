import { BigNumberType } from "@/types/internal";
import { filters } from "@/utils/globalFilters";

function validator(min: BigNumberType) {
  return (value?: BigNumberType) => {
    if (!value) {
      return true;
    }

    return !value.isLessThan(min);
  };
}

export default function (min: BigNumberType) {
  return {
    $validator: validator(min),
    $message: ({ $params }: any) =>
      `The amount should be greater than or equal to ${filters.formatBigNumber($params.min)}`,
    $params: { min, type: "minValue" }
  };
}
