import type { BigNumber } from "@/common/bigNumber";
import { createRule, Maybe } from "@regle/core";
import { useFormat } from "../composables/useFormat";
import { gt } from "@/i18n";

const format = useFormat();

export default createRule({
  type: "bigNumberMaxValue",
  validator(value: Maybe<BigNumber>, max: BigNumber) {
    if (!value) return true;
    return !value.isGreaterThan(max);
  },
  message: ({ $params: [max] }) => gt("validation.maxAmount", { max: format.number.decimal(max) })
});
