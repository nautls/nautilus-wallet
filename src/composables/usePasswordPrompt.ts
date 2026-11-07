import { computed, MaybeRefOrGetter, reactive, Ref, ref, toValue, watch } from "vue";
import { withMessage, withParams } from "@regle/rules";
import { useI18n } from "vue-i18n";
import { useToast } from "@/components/ui/toast";
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

/** A rule that fails once `password` is found to be the wrong master password, until edited. */
export function useWrongMasterPasswordRule(password: Ref<string>) {
  const { t } = useI18n();
  const wrong = ref(false);
  watch(password, () => (wrong.value = false));

  return {
    correct: withMessage(
      withParams((_, isWrong) => !isWrong, [wrong]),
      () => t("wallet.wrongMasterPassword")
    ),
    markWrong: () => (wrong.value = true)
  };
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
      unknown: () => t("wallet.requiredSpendingPassword")
    }),
    /** Title for the wrong password toast; `wrongHint` is its description. */
    wrong: byKind({
      master: () => t("wallet.wrongMasterPasswordTitle"),
      password: () => t("wallet.wrongWalletPasswordTitle", { name: name() }),
      unknown: () => t("wallet.wrongPassword")
    }),
    wrongHint: () => t("wallet.wrongPasswordHint")
  };
}

function byKind(texts: Record<PasswordKind | "unknown", () => string>) {
  return (kind?: PasswordKind) => texts[kind ?? "unknown"]();
}

/**
 * A signing prompt for the password the wallet uses: its texts, whether the unlock
 * session covers it (`unlocked`, so no password is asked), what to sign with, and what
 * to tell the user when signing fails.
 */
export function usePasswordPrompt(
  walletId: MaybeRefOrGetter<number | undefined>,
  walletName: MaybeRefOrGetter<string>
) {
  const { kind, reload: reloadKind } = usePasswordKind(walletId);
  const session = useUnlockSession();
  const texts = usePasswordTexts(walletName);
  const { toast } = useToast();
  const { t } = useI18n();

  const unlocked = computed(() => kind.value === "master" && session.active.value);
  const reload = () => Promise.all([reloadKind(), session.reload()]);

  /** What to sign with: the typed password, or nothing for the unlock session to stand in. */
  function passwordOrSession(password: string): string | undefined {
    return unlocked.value ? undefined : password;
  }

  /**
   * Tells the user about a wrong password or an ended session.
   *
   * @returns false for any other error, left to the caller.
   */
  async function handleError(e: unknown): Promise<boolean> {
    if (e instanceof SessionLockedError) {
      toast({ title: t("wallet.sessionLocked"), description: texts.required(kind.value) });
      await reload();
      return true;
    }

    if (e instanceof PasswordError) {
      toast({
        title: texts.wrong(kind.value),
        variant: "destructive",
        description: texts.wrongHint()
      });
      return true;
    }

    return false;
  }

  return reactive({
    kind,
    reload,
    unlocked,
    passwordOrSession,
    handleError,
    label: computed(() => texts.label(kind.value)),
    required: computed(() => texts.required(kind.value)),
    wrong: computed(() => texts.wrong(kind.value)),
    wrongHint: computed(texts.wrongHint)
  });
}
