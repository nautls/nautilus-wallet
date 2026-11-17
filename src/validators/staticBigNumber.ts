import type { BigNumber } from "@/common/bigNumber";
import { computed, MaybeRefOrGetter, toValue } from "vue";
import { markStatic } from "@regle/core";

/**
 * Regle treats object values as nested forms, so `BigNumber` instances must be
 * marked as static to be validated as plain fields.
 */
export function staticBigNumber(source: MaybeRefOrGetter<BigNumber | null | undefined>) {
  return computed(() => {
    const value = toValue(source);
    return value ? markStatic(value) : undefined;
  });
}
