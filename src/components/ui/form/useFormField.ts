import { computed, ComputedRef, inject, InjectionKey, provide } from "vue";

const FORM_FIELD_INVALID: InjectionKey<ComputedRef<boolean>> = Symbol("formFieldInvalid");

export function provideFormFieldInvalid(invalid: ComputedRef<boolean>) {
  provide(FORM_FIELD_INVALID, invalid);
}

export function useFormFieldInvalid(): ComputedRef<boolean> {
  return inject(
    FORM_FIELD_INVALID,
    computed(() => false),
    false
  );
}
