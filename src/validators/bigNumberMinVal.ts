import { createRule, Maybe } from "@regle/core";
import BigNumber from "bignumber.js";
import { useFormat } from "../composables/useFormat";
import { gt } from "@/i18n";

const format = useFormat();

export default createRule({
  type: "bigNumberMinValue",
  validator(value: Maybe<BigNumber>, min: BigNumber) {
    if (!value) return true;
    return !value.isLessThan(min);
  },
  message: ({ $params: [min] }) => gt("validation.minAmount", { min: format.number.decimal(min) })
});
