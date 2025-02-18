import { validateMnemonic } from "@fleet-sdk/wallet";

function validator(mnemonic: string) {
  if (mnemonic.trim() === "") return true;
  try {
    return validateMnemonic(mnemonic);
  } catch {
    return false;
  }
}

export default {
  $validator: validator,
  $message: "Invalid recovery phrase."
};
