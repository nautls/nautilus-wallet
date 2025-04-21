import BigNumber from "bignumber.js";
import { useFormat } from "../composables/useFormat";

const format = useFormat();

interface Params {
  max: BigNumber;
  type: string;
}

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
    $message: ({ $params }: { $params: Params }) =>
      `The amount should be less than or equal to ${format.number.decimal($params.max)}`,
    $params: { max, type: "maxValue" } as Params
  };
}
