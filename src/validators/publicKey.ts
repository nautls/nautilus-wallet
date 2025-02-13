import { isEmpty } from "@fleet-sdk/common";
import HdKey from "@/chains/ergo/hdKey";

function validator(value: string) {
  if (isEmpty(value)) return true;

  try {
    HdKey.fromPublicKey(value);
    return true;
  } catch {
    return false;
  }
}

export default {
  $validator: validator,
  $message: "Invalid public key"
};
