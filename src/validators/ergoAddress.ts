import { isEmpty } from "@fleet-sdk/common";
import { createRule, Maybe } from "@regle/core";
import { validateAddress } from "@/chains/ergo/addresses";
import { gt } from "@/i18n";

export default createRule({
  type: "ergoAddress",
  validator(value: Maybe<string>) {
    if (isEmpty(value)) return true;
    return validateAddress(value);
  },
  message: () => gt("validation.invalidAddress")
});
