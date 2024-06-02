import { isEmpty, join } from "lodash-es";
import { validateMnemonic } from "@fleet-sdk/wallet";

function validator(words: []) {
  if (isEmpty(words)) {
    return false;
  }

  try {
    return validateMnemonic(join(words, " "));
  } catch (e) {
    return false;
  }
}

export default {
  $validator: validator,
  $message: "Invalid mnemonic phrase."
};
