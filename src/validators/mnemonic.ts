import { createRule, Maybe } from "@regle/core";
import { validateMnemonic } from "@fleet-sdk/wallet";
import { gt } from "@/i18n";

export default createRule({
  type: "mnemonic",
  validator(mnemonic: Maybe<string>) {
    if (!mnemonic || mnemonic.trim() === "") return true;
    try {
      return validateMnemonic(mnemonic);
    } catch {
      return false;
    }
  },
  message: () => gt("validation.invalidRecoveryPhrase")
});
