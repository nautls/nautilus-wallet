import { BigNumber } from "bignumber.js";
import { useFormat } from "../composables/useFormat";

const format = useFormat();

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
      `The amount should be less than or equal to ${format.bn.format($params.max)}`,
    $params: { max, type: "maxValue" }
  };
}
