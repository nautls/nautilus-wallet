import { isEmpty } from "@fleet-sdk/common";
import { createRule, Maybe } from "@regle/core";

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
  message: "Invalid URL."
});
