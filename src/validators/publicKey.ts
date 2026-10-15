import { isEmpty } from "@fleet-sdk/common";
import { createRule, Maybe } from "@regle/core";
import HdKey from "@/chains/ergo/hdKey";
import { gt } from "@/i18n";

export default createRule({
  type: "publicKey",
  validator(value: Maybe<string>) {
    if (isEmpty(value)) return true;

    try {
      HdKey.fromPublicKey(value);
      return true;
    } catch {
      return false;
    }
  },
  message: () => gt("validation.invalidPublicKey")
});
