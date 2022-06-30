import { validateAddress } from "@/api/ergo/addresses";
import { isEmpty } from "lodash";

function validator(value: string) {
  if (isEmpty(value)) {
    return false;
  }

  return validateAddress(value);
}

export default {
  $validator: validator,
  $message: "Invalid Ergo address."
};
