import { isEmpty } from "@fleet-sdk/common";
import { validateAddress } from "@/chains/ergo/addresses";

function validator(value: string) {
  if (isEmpty(value)) return true;
  return validateAddress(value);
}

export default {
  $validator: validator,
  $message: "Please enter a valid Ergo address."
};
