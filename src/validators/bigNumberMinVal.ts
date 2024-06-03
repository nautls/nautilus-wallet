import { BigNumberType } from "@/types/internal";
import { filters } from "@/common/globalFilters";
import { ValidationRuleWithParams } from "@vuelidate/core";

function validator(min: BigNumberType) {
  return (value?: BigNumberType) => {
    if (!value) {
      return true;
    }

    return !value.isLessThan(min);
  };
}

export default function (min: BigNumberType): ValidationRuleWithParams<{ min: BigNumberType }> {
  return {
    $validator: validator(min),
    $message: ({ $params }) =>
      `The amount should be greater than or equal to ${filters.formatBigNumber($params.min)}`,
    $params: { min }
  };
}
