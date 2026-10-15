import { createRule, Maybe } from "@regle/core";
import BigNumber from "bignumber.js";
import { useFormat } from "../composables/useFormat";

const format = useFormat();

export default createRule({
  type: "bigNumberMinValue",
  validator(value: Maybe<BigNumber>, min: BigNumber) {
    if (!value) return true;
    return !value.isLessThan(min);
  },
  message: ({ $params: [min] }) =>
    `The amount should be greater than or equal to ${format.number.decimal(min)}`
});
