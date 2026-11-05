import { computed, MaybeRefOrGetter, reactive, ref, toValue, watch } from "vue";
import { useI18n } from "vue-i18n";
import { PasswordKind, walletsDbService } from "@/database/walletsDbService";

/**
 * Texts for a prompt that asks for a wallet's password, naming the one it wants: the
 * master password, or the wallet's own (`"Savings" password`).
 */
export function usePasswordPrompt(
  walletId: MaybeRefOrGetter<number | undefined>,
  walletName: MaybeRefOrGetter<string>
) {
  const { t } = useI18n();
  const kind = ref<PasswordKind>();

  watch(
    () => toValue(walletId),
    async (id) => {
      kind.value = undefined;
      if (!id) return;

      const loaded = await walletsDbService.getPasswordKind(id);
      if (toValue(walletId) === id) kind.value = loaded;
    },
    { immediate: true }
  );

  /** Picks the text for the password `kind` asks for, or a generic one while loading. */
  function pick(texts: { master: () => string; password: () => string; unknown: () => string }) {
    return computed(() => (kind.value ? texts[kind.value]() : texts.unknown()));
  }

  const name = () => toValue(walletName);

  return reactive({
    kind,
    label: pick({
      master: () => t("wallet.masterPassword"),
      password: () => t("wallet.namedWalletPassword", { name: name() }),
      unknown: () => t("wallet.password")
    }),
    required: pick({
      master: () => t("wallet.enterMasterPassword"),
      password: () => t("wallet.enterWalletPassword", { name: name() }),
      unknown: () => t("wallet.requiredSpendingPassword")
    }),
    /** Title for the wrong password toast; {@link wrongHint} is its description. */
    wrong: pick({
      master: () => t("wallet.wrongMasterPasswordTitle"),
      password: () => t("wallet.wrongWalletPasswordTitle", { name: name() }),
      unknown: () => t("wallet.wrongPassword")
    }),
    wrongHint: computed(() => t("wallet.wrongPasswordHint"))
  });
}
