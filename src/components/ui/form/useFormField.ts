import { computed, ComputedRef, inject, InjectionKey, provide } from "vue";

export interface FormFieldContext {
  id: string;
  invalid: ComputedRef<boolean>;
  describedBy: ComputedRef<string | undefined>;
}

const FORM_FIELD: InjectionKey<FormFieldContext> = Symbol("formField");

export function provideFormField(context: FormFieldContext) {
  provide(FORM_FIELD, context);
}

export function useFormField(): FormFieldContext | undefined {
  return inject(FORM_FIELD, undefined);
}

export function useFormFieldInvalid(): ComputedRef<boolean> {
  const field = useFormField();
  return computed(() => field?.invalid.value ?? false);
}
