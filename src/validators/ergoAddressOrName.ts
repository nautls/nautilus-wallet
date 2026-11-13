import { isEmpty } from "@fleet-sdk/common";
import { createRule, Maybe } from "@regle/core";
import { validateAddress } from "@/chains/ergo/addresses";
import { isName, normalizeName } from "@/chains/ergo/services/nameService";
import { gt } from "@/i18n";
import type { NameLookup } from "@/composables/useNameLookups";

/** An address, or a name whose lookup resolved and whose address did not change since shown. */
export default createRule({
  type: "ergoAddressOrName",
  validator(value: Maybe<string>, lookups: Map<string, NameLookup>) {
    if (isEmpty(value)) return true;
    if (!isName(value)) return validateAddress(value);

    const lookup = lookups.get(normalizeName(value));
    return (
      lookup?.state === "done" && lookup.result.status === "resolved" && !lookup.addressChanged
    );
  },
  message: ({ $value, $params: [lookups] }) => {
    if (!isName($value)) return gt("validation.invalidAddress");

    const lookup = lookups.get(normalizeName($value));
    if (!lookup || lookup.state === "loading") return gt("validation.nameChecking");
    if (lookup.state === "failed") {
      return lookup.reason === "unverified"
        ? gt("validation.nameUnverified")
        : gt("validation.nameUnavailable");
    }
    if (lookup.addressChanged) return gt("validation.nameAddressChanged");

    switch (lookup.result.status) {
      case "not_registered":
        return gt("validation.nameNotRegistered");
      case "expired":
        return gt("validation.nameExpired");
      default:
        return gt("validation.nameInvalid");
    }
  }
});
