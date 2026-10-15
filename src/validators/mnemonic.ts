import { createRule, Maybe } from "@regle/core";
import { validateMnemonic } from "@fleet-sdk/wallet";

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
  message: "Invalid recovery phrase."
});
