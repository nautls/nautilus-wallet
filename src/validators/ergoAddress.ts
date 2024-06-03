import { isEmpty } from "@fleet-sdk/common";
import { validateAddress } from "@/chains/ergo/addresses";

function validator(value: string) {
  if (isEmpty(value)) return false;
  return validateAddress(value);
}

export default {
  $validator: validator,
  $message: "Invalid Ergo address."
};
