import { wasmModule } from "@/utils/wasm-module";
import { isEmpty } from "lodash";

function validator(value: string) {
  if (isEmpty(value)) {
    return false;
  }

  try {
    wasmModule.SigmaRust.Address.from_mainnet_str(value);
  } catch (e) {
    return false;
  }

  return true;
}

export default {
  $validator: validator,
  $message: "Invalid Ergo address."
};
