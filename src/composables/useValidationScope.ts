import { inject, InjectionKey, provide, useId } from "vue";
import { useCollectScope, useRegle, useScopedRegle } from "@regle/core";

const VALIDATION_SCOPE_KEY: InjectionKey<string> = Symbol("validation-scope");

type AnyRegleFn = (state: unknown, rules: unknown, options?: object) => unknown;

/**
 * Collects the validations of descendant components created with `useChildRegle`.
 * Each call creates its own namespace, so only components rendered within the
 * calling component's tree are collected.
 */
export function useCollectChildValidations() {
  const namespace = `validation-scope-${useId()}`;
  provide(VALIDATION_SCOPE_KEY, namespace);

  return useCollectScope(namespace);
}

/**
 * Same as `useRegle`, but registers the instance into the closest ancestor scope
 * created by `useCollectChildValidations`, if any.
 */
export const useChildRegle = ((state: unknown, rules: unknown, options?: object) => {
  const namespace = inject(VALIDATION_SCOPE_KEY, undefined);
  if (!namespace) return (useRegle as AnyRegleFn)(state, rules, options);

  return (useScopedRegle as AnyRegleFn)(state, rules, { ...options, namespace });
}) as typeof useRegle;
