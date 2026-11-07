import { computed, MaybeRefOrGetter, reactive, ref, toValue, watch } from "vue";
import { useI18n } from "vue-i18n";
import { PasswordKind, walletsDbService } from "@/database/walletsDbService";

export function usePasswordKind(walletId: MaybeRefOrGetter<number | undefined>) {
  const kind = ref<PasswordKind>();

  /** Reads which password the wallet uses again, such as after a move. */
  async function reload() {
    const id = toValue(walletId);
    kind.value = undefined;
    if (!id) return;

    const loaded = await walletsDbService.getPasswordKind(id);
    if (toValue(walletId) === id) kind.value = loaded;
  }

  watch(() => toValue(walletId), reload, { immediate: true });

  return { kind, reload };
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

/** Texts for a prompt that asks for the password the wallet uses. */
export function usePasswordPrompt(
  walletId: MaybeRefOrGetter<number | undefined>,
  walletName: MaybeRefOrGetter<string>
) {
  const { kind, reload } = usePasswordKind(walletId);
  const texts = usePasswordTexts(walletName);

  return reactive({
    kind,
    reload,
    label: computed(() => texts.label(kind.value)),
    required: computed(() => texts.required(kind.value)),
    wrong: computed(() => texts.wrong(kind.value)),
    wrongHint: computed(texts.wrongHint)
  });
}
