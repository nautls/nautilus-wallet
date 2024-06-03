import { isUndefined } from "@fleet-sdk/common";
import { Coder } from "@fleet-sdk/crypto";
import { parse } from "@fleet-sdk/serializer";

export function sigmaDecode<T>(value: string, coder?: Coder<unknown, T>) {
  const v = parse<T>(value, "safe");
  if (isUndefined(v)) return;

  return coder ? coder.encode(v) : v;
}
