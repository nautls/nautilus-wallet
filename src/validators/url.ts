import { isEmpty } from "@fleet-sdk/common";
import { createRule, Maybe } from "@regle/core";
import { gt } from "@/i18n";

export default createRule({
  type: "url",
  validator(value: Maybe<string>) {
    if (isEmpty(value)) return true;

    try {
      return Boolean(new URL(value));
    } catch {
      return false;
    }
  },
  message: () => gt("validation.invalidUrl")
});
