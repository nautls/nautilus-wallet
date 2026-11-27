import { computed, MaybeRefOrGetter, reactive, Ref, ref, toValue, watch } from "vue";
import { requiredUnless, withMessage, withParams } from "@regle/rules";
import { useI18n } from "vue-i18n";
import { PasswordError, SessionLockedError } from "@/common/errors";
import { log } from "@/common/logger";
import { PasswordKind, walletsDbService } from "@/database/walletsDbService";
import { useUnlockSession } from "./useUnlockSession";

export function usePasswordKind(walletId: MaybeRefOrGetter<number | undefined>) {
  const kind = ref<PasswordKind>();
  let latest = 0;

  /** Reads which password the wallet uses again, such as after a move. */
  async function reload() {
    const call = ++latest;
    const id = toValue(walletId);
    const loaded = id ? await walletsDbService.getPasswordKind(id) : undefined;
    if (call === latest) kind.value = loaded;
  }

  const logged = () => void reload().catch((e) => log.error(e));

  watch(
    () => toValue(walletId),
    (id, _, onCleanup) => {
      kind.value = undefined;
      logged();
      if (id) onCleanup(walletsDbService.onPasswordKindChange(id, logged));
    },
    { immediate: true }
  );

  return { kind, reload };
}

/** A rule that fails once `password` is found to be wrong, until edited. */
export function useWrongPasswordRule(password: Ref<string>, message: () => string) {
  const wrong = ref(false);
  watch(password, () => (wrong.value = false));

  return {
    correct: withMessage(
      withParams((_, isWrong) => !isWrong, [wrong]),
      message
    ),
    markWrong: () => (wrong.value = true)
  };
}

export function useWrongMasterPasswordRule(password: Ref<string>) {
  const { t } = useI18n();
  return useWrongPasswordRule(password, () => t("wallet.wrongMasterPassword"));
}

/**
 * Texts naming the password a prompt asks for: the master password, or the wallet's
 * own (`"Savings" password`). A generic text stands in while `kind` is unknown.
 */
export function usePasswordTexts(walletName: MaybeRefOrGetter<string>) {
  const { t } = useI18n();
  const name = () => toValue(walletName);

  return {
    label: byKind({
      master: () => t("wallet.masterPassword"),
      password: () => t("wallet.namedWalletPassword", { name: name() }),
      unknown: () => t("wallet.password")
    }),
    required: byKind({
      master: () => t("wallet.enterMasterPassword"),
      password: () => t("wallet.enterWalletPassword", { name: name() }),
      unknown: () => t("wallet.enterYourWalletPassword")
    }),
    wrong: byKind({
      master: () => t("wallet.wrongMasterPassword"),
      password: () => t("wallet.wrongWalletPassword", { name: name() }),
      unknown: () => t("wallet.wrongPassword")
    })
  };
}

function byKind(texts: Record<PasswordKind | "unknown", () => string>) {
  return (kind?: PasswordKind) => texts[kind ?? "unknown"]();
}

/**
 * A signing prompt for the password the wallet uses: its texts, whether the unlock
 * session covers it (`unlocked`, so no password is asked), what to sign with, and how
 * a failed signing shows on the password field.
 */
export function usePasswordPrompt(
  walletId: MaybeRefOrGetter<number | undefined>,
  walletName: MaybeRefOrGetter<string>,
  password: Ref<string>
) {
  const { kind, reload: reloadKind } = usePasswordKind(walletId);
  const session = useUnlockSession();
  const texts = usePasswordTexts(walletName);
  const wrongPassword = useWrongPasswordRule(password, () => texts.wrong(kind.value));

  const unlocked = computed(() => kind.value === "master" && session.active.value);
  const reload = () => Promise.all([reloadKind(), session.reload()]);

  /** Requires the password, unless the unlock session covers it or `skips` is true. */
  function requiredRule(skips: () => boolean = () => false) {
    const skipped = computed(() => unlocked.value || skips());
    return withMessage(requiredUnless(skipped), () => texts.required(kind.value));
  }

  /** Fails once the password was refused, until edited. */
  function correctRule() {
    return wrongPassword.correct;
  }

  /** What to sign with: the typed password, or nothing for the unlock session to stand in. */
  function passwordOrSession(password: string): string | undefined {
    return unlocked.value ? undefined : password;
  }

  /**
   * Shows a wrong password, or an ended session that now asks for it, on `field`.
   *
   * @returns false for any other error, left to the caller.
   */
  async function handleError(e: unknown, field: { $validate(): Promise<unknown> }) {
    if (e instanceof SessionLockedError) {
      await reload();
    } else if (e instanceof PasswordError) {
      wrongPassword.markWrong();
    } else {
      return false;
    }

    await field.$validate();
    return true;
  }

  return reactive({
    kind,
    reload,
    unlocked,
    passwordOrSession,
    requiredRule,
    correctRule,
    handleError,
    label: computed(() => texts.label(kind.value)),
    required: computed(() => texts.required(kind.value)),
    wrong: computed(() => texts.wrong(kind.value))
  });
}
