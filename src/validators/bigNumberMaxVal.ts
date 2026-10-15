import { createRule, Maybe } from "@regle/core";
import BigNumber from "bignumber.js";
import { useFormat } from "../composables/useFormat";

const format = useFormat();

export default createRule({
  type: "bigNumberMaxValue",
  validator(value: Maybe<BigNumber>, max: BigNumber) {
    if (!value) return true;
    return !value.isGreaterThan(max);
  },
  message: ({ $params: [max] }) =>
    `The amount should be less than or equal to ${format.number.decimal(max)}`
});
