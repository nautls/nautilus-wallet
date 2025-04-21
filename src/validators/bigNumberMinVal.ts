import { ValidationRuleWithParams } from "@vuelidate/core";
import BigNumber from "bignumber.js";
import { useFormat } from "../composables/useFormat";

const format = useFormat();

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
      `The amount should be greater than or equal to ${format.number.decimal($params.min)}`,
    $params: { min }
  };
}
