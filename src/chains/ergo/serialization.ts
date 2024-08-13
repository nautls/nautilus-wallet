import { isUndefined } from "@fleet-sdk/common";
import { Coder } from "@fleet-sdk/crypto";
import { parse, SConstant } from "@fleet-sdk/serializer";

export function sigmaDecode<T>(value: string, coder?: Coder<unknown, T>) {
  const v = parse<T>(value, "safe");
  if (isUndefined(v)) return;

  return coder ? coder.encode(v) : v;
}

export function safeSigmaDecode<T>(value?: string): SConstant<T> | undefined {
  if (!value) return;
  try {
    return SConstant.from<T>(value);
  } catch {
    return;
  }
}
