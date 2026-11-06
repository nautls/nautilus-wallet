import { computed, MaybeRefOrGetter, reactive, Ref, ref, toValue } from "vue";
import { useRegle } from "@regle/core";
import { applyIf, minLength, required, withMessage, withParams } from "@regle/rules";
import type { Score } from "@zxcvbn-ts/core";
import { useI18n } from "vue-i18n";
import { strongPassword, usePasswordStrength } from "./usePasswordStrength";

export const MIN_PASSWORD_LENGTH = 10;

/**
 * A new password and its confirmation, with the length, strength and match rules.
 *
 * @param userInputs words that make a password easy to guess, such as the wallet name.
 */
export function useNewPassword(userInputs?: MaybeRefOrGetter<string[]>) {
  const { t } = useI18n();

  const password = ref("");
  const confirmPassword = ref("");
  const strength = usePasswordStrength(password, userInputs);
  const rules = useNewPasswordRules(password, strength.score);

  const { r$ } = useRegle(
    { password, confirmPassword },
    {
      password: {
        required: withMessage(required, () => t("wallet.newPasswordRequired")),
        ...rules.password
      },
      confirmPassword: rules.confirmPassword
    },
    { autoDirty: false }
  );

  /** @returns the new password, or undefined if a rule fails. */
  async function validate(): Promise<string | undefined> {
    // a quick submit can come before the debounced score, or before the scorer loads
    await strength.evaluate();
    const { valid } = await r$.$validate();
    return valid ? password.value : undefined;
  }

  function reset() {
    password.value = "";
    confirmPassword.value = "";
    r$.$reset();
  }

  return reactive({
    password,
    confirmPassword,
    strength: strength.score,
    rules: r$,
    validate,
    reset
  });
}

export function useNewPasswordRules(
  password: Ref<string>,
  score: Ref<Score | undefined>,
  isNew: MaybeRefOrGetter<boolean> = true
) {
  const { t } = useI18n();
  const active = computed(() => toValue(isNew));
  const longEnough = computed(() => password.value.length >= MIN_PASSWORD_LENGTH);

  return {
    password: {
      minLength: applyIf(
        active,
        withMessage(minLength(MIN_PASSWORD_LENGTH), () =>
          t("wallet.minPasswordLength", { min: MIN_PASSWORD_LENGTH })
        )
      ),
      // only once it's long enough, so a short password gets a single error
      strong: applyIf(
        () => active.value && longEnough.value,
        strongPassword(score, () => t("wallet.passwordTooGuessable"))
      )
    },
    confirmPassword: {
      matches: withMessage(
        withParams((value, pwd, isNew) => !isNew || value === pwd, [password, active]),
        () => t("wallet.passwordsDontMatch")
      )
    }
  };
}
