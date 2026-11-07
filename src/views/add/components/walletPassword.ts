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
import { requiredUnless, withMessage } from "@regle/rules";
import { useI18n } from "vue-i18n";
import { useNewPasswordRules } from "@/composables/useNewPassword";
import { useToast } from "@/components/ui/toast";
import { useWrongMasterPasswordRule } from "@/composables/usePasswordPrompt";
import { useUnlockSession } from "@/composables/useUnlockSession";
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
  const session = useUnlockSession();
  /** The unlock session stands in for the existing master password. */
  const usesSession = computed(() => mode.value === "unlock" && session.active.value);
  const strength = usePasswordStrength(password, userInputs);
  const newRules = useNewPasswordRules(password, strength.score, isNewPassword);

  watch(mode, reset);
  const wrongPassword = useWrongMasterPasswordRule(password);
  const { toast } = useToast();

  const { r$: rules } = useRegle(
    { password, confirmPassword },
    {
      password: {
        required: withMessage(requiredUnless(usesSession), () =>
          mode.value === "separate"
            ? t("wallet.walletPasswordRequired")
            : t("wallet.masterPasswordRequired")
        ),
        ...newRules.password,
        correct: wrongPassword.correct
      },
      confirmPassword: newRules.confirmPassword
    },
    { autoDirty: false }
  );

  /**
   * Validates the fields and, for an existing master password, checks it's correct, so
   * a typo shows up here rather than once the wallet is about to be saved.
   *
   * @param options.verify false to skip that check, when saving the wallet checks it anyway.
   */
  async function validate({ verify = true } = {}): Promise<
    { password?: string; passwordKind: PasswordKind } | undefined
  > {
    if (usesSession.value) return { passwordKind: "master" };

    // a quick click can come before the debounced score, or before the scorer loads
    if (isNewPassword.value) await strength.evaluate();
    const { valid } = await rules.$validate();
    if (!valid) return;

    if (verify && mode.value === "unlock") {
      let correct: boolean;
      try {
        verifying.value = true;
        correct = await walletsDbService.verifyMasterPassword(password.value);
      } finally {
        verifying.value = false;
      }

      if (!correct) {
        await rejectPassword();
        return;
      }
    }

    return { password: password.value, passwordKind: useMaster.value ? "master" : "password" };
  }

  async function rejectPassword() {
    wrongPassword.markWrong();
    await rules.password.$validate();
  }

  /** For a save refused because the session ended since the master password was skipped. */
  async function rejectSession() {
    await session.reload();
    toast({ title: t("wallet.sessionLocked"), description: t("wallet.masterPasswordUnlockDesc") });
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
    usesSession,
    strength: strength.score,
    rules,
    validate,
    validateUnlock,
    rejectPassword,
    rejectSession,
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
