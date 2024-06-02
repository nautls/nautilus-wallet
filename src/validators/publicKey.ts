import HdKey from "@/api/ergo/hdKey";
import { isEmpty } from "lodash-es";

function validator(value: string) {
  if (isEmpty(value)) {
    return false;
  }

  try {
    HdKey.fromPublicKey(value);
  } catch (e) {
    return false;
  }

  return true;
}

export default {
  $validator: validator,
  $message: "Invalid public key."
};
