import Bip32 from "@/api/ergo/bip32";
import { isEmpty } from "lodash";

function validator(value: string) {
  if (isEmpty(value)) {
    return false;
  }

  try {
    Bip32.fromPublicKey(value);
  } catch (e) {
    return false;
  }

  return true;
}

export default {
  $validator: validator,
  $message: "Invalid public key."
};
