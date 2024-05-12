import { isEmpty } from "lodash-es";

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
