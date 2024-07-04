import { isEmpty } from "@fleet-sdk/common";

function validator(value: string) {
  if (isEmpty(value)) {
    return true;
  }

  return Boolean(new URL(value));
}

export default {
  $validator: validator,
  $message: "Invalid URL."
};
