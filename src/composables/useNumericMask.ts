import { onBeforeUnmount, onMounted, Ref, shallowRef, watch } from "vue";
import { BigNumber } from "bignumber.js";
import Cleave, { CleaveOptions } from "cleave.js";
import { bn } from "@/common/bigNumber";

interface HTMLCleaveInputElement extends HTMLInputElement {
  cleave?: Cleave;
}

type MaskOptions = Omit<CleaveOptions, "onValueChanged" | "numeral">;

export function useNumericMask(inputEl: Ref<HTMLCleaveInputElement | null>, options?: MaskOptions) {
  const valueRef = shallowRef<BigNumber | null>();
  let currentValue: BigNumber | null;

  onMounted(() => {
    if (!inputEl.value) throw new Error("Input element not found.");

    inputEl.value.cleave = new Cleave(inputEl.value, {
      ...options,
      numeral: true,
      onValueChanged: (e) => {
        currentValue = parse(e.target.rawValue);
        if (eq(currentValue, valueRef.value)) return; // if values are equal, don't update reactive value

        valueRef.value = currentValue;
      }
    });
  });

  onBeforeUnmount(() => inputEl.value?.cleave?.destroy());

  watch(valueRef, (v) => {
    if (eq(v, currentValue)) return;
    inputEl.value?.cleave?.setRawValue(!v || v.isNaN() ? "" : v.toString());
  });

  return valueRef;
}

export function parse(raw: string): BigNumber | null {
  if (!raw) return null;

  raw = raw.replaceAll(",", "");
  let parsed: BigNumber;
  if (raw.endsWith(".") && raw.length > 1) {
    parsed = bn(raw.substring(0, raw.length - 1));
  } else if (raw.startsWith(".") && raw.length > 1) {
    parsed = bn("0" + raw);
  } else {
    parsed = bn(raw);
  }

  return parsed.isNaN() ? null : parsed;
}

function eq(a?: BigNumber | null, b?: BigNumber | null): boolean {
  if (!a && !b) return true; // both are falsy, thus equal
  if (a && b && a.eq(b)) return true; // values are equal BigNumbers
  return false;
}
