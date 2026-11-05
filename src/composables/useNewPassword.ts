import { computed, MaybeRefOrGetter, reactive, ref } from "vue";
import { useRegle } from "@regle/core";
import { applyIf, minLength, required, withMessage, withParams } from "@regle/rules";
import { useI18n } from "vue-i18n";
import { strongPassword, usePasswordStrength } from "./usePasswordStrength";

export const MIN_PASSWORD_LENGTH = 10;

export type NewPassword = ReturnType<typeof useNewPassword>;

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
  const longEnough = computed(() => password.value.length >= MIN_PASSWORD_LENGTH);

  const { r$: rules } = useRegle(
    { password, confirmPassword },
    {
      password: {
        required: withMessage(required, () => t("wallet.newPasswordRequired")),
        minLength: withMessage(minLength(MIN_PASSWORD_LENGTH), () =>
          t("wallet.minPasswordLength", { min: MIN_PASSWORD_LENGTH })
        ),
        // only once it's long enough, so a short password gets a single error
        strong: applyIf(
          longEnough,
          strongPassword(strength.score, () => t("wallet.passwordTooGuessable"))
        )
      },
      confirmPassword: {
        matches: withMessage(
          withParams((value, pwd) => value === pwd, [password]),
          () => t("wallet.passwordsDontMatch")
        )
      }
    },
    { autoDirty: false }
  );

  /** @returns the new password, or undefined if a rule fails. */
  async function validate(): Promise<string | undefined> {
    // a quick submit can come before the debounced score, or before the scorer loads
    await strength.evaluate();
    const { valid } = await rules.$validate();
    return valid ? password.value : undefined;
  }

  function reset() {
    password.value = "";
    confirmPassword.value = "";
    rules.$reset();
  }

  return reactive({
    password,
    confirmPassword,
    strength: strength.score,
    rules,
    validate,
    reset
  });
}
