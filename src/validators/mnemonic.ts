import { isEmpty, join } from "lodash";
import { validateMnemonic } from "bip39";

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
