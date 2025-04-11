import { onBeforeUnmount, onMounted, Ref, shallowRef, watch } from "vue";
import BigNumber from "bignumber.js";
import Cleave, { CleaveOnChangedEvent, CleaveOptions } from "cleave.js";
import { bn } from "@/common/bigNumber";

interface HTMLCleaveInputElement extends HTMLInputElement {
  cleave?: Cleave;
}

export type MaskOptions = Omit<CleaveOptions, "onValueChanged" | "numeral">;

export function useNumericMask(
  inputEl: Ref<HTMLCleaveInputElement | null>,
  initialOptions?: MaskOptions
) {
  const valueRef = shallowRef<BigNumber | null>();
  let quietlyPatched = false;
  let currentValue: BigNumber | null;

  const onChanged = (e: CleaveOnChangedEvent) => {
    if (quietlyPatched) {
      quietlyPatched = false;
      return;
    }

    currentValue = parse(e.target.rawValue);
    if (eq(currentValue, valueRef.value)) return; // if values are equal, don't update reactive value
    valueRef.value = currentValue;
  };

  const create = (options?: MaskOptions) => {
    if (!inputEl.value) throw new Error("Input element not found.");

    inputEl.value.cleave = new Cleave(inputEl.value, {
      ...(options ?? initialOptions),
      numeral: true,
      onValueChanged: onChanged
    });
  };

  const destroy = () => inputEl.value?.cleave?.destroy();

  /**
   * Patches the mask options and updates the input value accordingly.
   */
  const patchOptions = (options: MaskOptions) => {
    destroy();
    create(options);
  };

  /**
   * Quietly patches the mask options without touching the input value.
   */
  const patchOptionsQuietly = (options: MaskOptions) => {
    quietlyPatched = true;
    patchOptions(options);
  };

  onMounted(create);
  onBeforeUnmount(destroy);

  watch(valueRef, (v) => {
    if (eq(v, currentValue)) return;
    inputEl.value?.cleave?.setRawValue(!v || v.isNaN() ? "" : v.toString());
  });

  return { value: valueRef, patchOptions, patchOptionsQuietly };
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
  if (!a && !b) return true; // both are falsy
  if (a && b && a.eq(b)) return true; // values are defined and equal
  return false;
}
