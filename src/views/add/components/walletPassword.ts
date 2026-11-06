import {
  computed,
  inject,
  InjectionKey,
  MaybeRefOrGetter,
  onMounted,
  provide,
  reactive,
  ref,
  watch
} from "vue";
import { useRegle } from "@regle/core";
import { required, withMessage, withParams } from "@regle/rules";
import { useI18n } from "vue-i18n";
import { useNewPasswordRules } from "@/composables/useNewPassword";
import { usePasswordStrength } from "@/composables/usePasswordStrength";
import { PasswordKind, walletsDbService } from "@/database/walletsDbService";

export type WalletPassword = ReturnType<typeof createWalletPassword>;
const key: InjectionKey<WalletPassword> = Symbol("walletPassword");

/**
 * Password state shared by the create/import steps, so the master password switch and
 * the password fields can live on different steps.
 */
export function provideWalletPassword(
  options: { userInputs?: MaybeRefOrGetter<string[]> } = {}
): WalletPassword {
  const state = createWalletPassword(options.userInputs);
  provide(key, state);
  return state;
}

export function injectWalletPassword(): WalletPassword {
  const state = inject(key);
  if (!state) throw Error("provideWalletPassword() wasn't called");
  return state;
}

function createWalletPassword(userInputs?: MaybeRefOrGetter<string[]>) {
  const { t } = useI18n();

  const hasMaster = ref<boolean>();
  const useMaster = ref(true);
  const password = ref("");
  const confirmPassword = ref("");
  const wrongPassword = ref(false);
  const verifying = ref(false);

  onMounted(async () => {
    hasMaster.value = await walletsDbService.hasMasterPassword();
  });

  /**
   * - `setup`: no master password yet, this wallet sets it up;
   * - `unlock`: types the existing master password;
   * - `separate`: picks a password for this wallet only.
   */
  const mode = computed(() => {
    if (!useMaster.value) return "separate";
    return hasMaster.value ? "unlock" : "setup";
  });
  /** A new password needs its own step, with a confirmation. */
  const isNewPassword = computed(() => mode.value !== "unlock");
  const strength = usePasswordStrength(password, userInputs);
  const newRules = useNewPasswordRules(password, strength.score, isNewPassword);

  watch(mode, reset);
  watch(password, () => (wrongPassword.value = false));

  const { r$: rules } = useRegle(
    { password, confirmPassword },
    {
      password: {
        required: withMessage(required, () =>
          mode.value === "separate"
            ? t("wallet.walletPasswordRequired")
            : t("wallet.masterPasswordRequired")
        ),
        ...newRules.password,
        correct: withMessage(
          withParams((_, wrong) => !wrong, [wrongPassword]),
          () => t("wallet.wrongMasterPassword")
        )
      },
      confirmPassword: newRules.confirmPassword
    },
    { autoDirty: false }
  );

  /**
   * Validates the fields and, for an existing master password, checks it's correct, so
   * a typo shows up here rather than once the wallet is about to be saved.
   */
  async function validate(): Promise<{ password: string; passwordKind: PasswordKind } | undefined> {
    // a quick click can come before the debounced score, or before the scorer loads
    if (isNewPassword.value) await strength.evaluate();
    const { valid } = await rules.$validate();
    if (!valid) return;

    if (mode.value === "unlock") {
      try {
        verifying.value = true;
        wrongPassword.value = !(await walletsDbService.verifyMasterPassword(password.value));
      } finally {
        verifying.value = false;
      }

      if (wrongPassword.value) {
        await rules.password.$validate();
        return;
      }
    }

    return { password: password.value, passwordKind: useMaster.value ? "master" : "password" };
  }

  async function validateUnlock(): Promise<boolean> {
    return isNewPassword.value || !!(await validate());
  }

  function reset() {
    password.value = "";
    confirmPassword.value = "";
    rules.$reset();
  }

  return reactive({
    hasMaster,
    useMaster,
    password,
    confirmPassword,
    mode,
    isNewPassword,
    strength: strength.score,
    rules,
    validate,
    validateUnlock,
    stepTexts: computed(() =>
      useMaster.value
        ? { title: t("wallet.masterPassword"), description: t("wallet.masterPasswordStepDesc") }
        : { title: t("wallet.walletPassword"), description: t("wallet.walletPasswordStepDesc") }
    ),
    createLabel: computed(() =>
      useMaster.value ? t("wallet.createMasterPassword") : t("wallet.createWalletPassword")
    ),
    loaded: computed(() => hasMaster.value !== undefined),
    verifying,
    invalid: computed(() => rules.$invalid)
  });
}
