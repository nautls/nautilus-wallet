import { ValidationRuleWithParams } from "@vuelidate/core";
import { BigNumber } from "bignumber.js";
import { filters } from "@/common/globalFilters";

function validator(min: BigNumber) {
  return (value?: BigNumber) => {
    if (!value) {
      return true;
    }

    return !value.isLessThan(min);
  };
}

export default function (min: BigNumber): ValidationRuleWithParams<{ min: BigNumber }> {
  return {
    $validator: validator(min),
    $message: ({ $params }) =>
      `The amount should be greater than or equal to ${filters.bn.format($params.min)}`,
    $params: { min }
  };
}
