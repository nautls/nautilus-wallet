import { nextTick } from "vue";
import { createI18n } from "petite-vue-i18n";
import type { I18n, I18nOptions, Locale } from "petite-vue-i18n";
import en from "../locales/en.json";

export const SUPPORT_LOCALES = ["en", "pt"] as const;

type NonLegacyI18n = I18n<
  { en: typeof en },
  Record<string, unknown>,
  Record<string, unknown>,
  Locale,
  false
>;

export function getLocale(i18n: NonLegacyI18n): Locale {
  return i18n.global.locale.value;
}

export function setLocale(i18n: NonLegacyI18n, locale: Locale): void {
  i18n.global.locale.value = locale;
}

export function setupI18n(): NonLegacyI18n {
  const opt = {
    legacy: false,
    locale: "en",
    fallbackLocale: "en",
    messages: { en }
  } satisfies I18nOptions;

  const i18n = createI18n(opt);
  setI18nLanguage(i18n, opt.locale);

  return i18n;
}

export function setI18nLanguage(i18n: NonLegacyI18n, locale: Locale): void {
  setLocale(i18n, locale);
  document.querySelector("html")?.setAttribute("lang", locale);
}

export async function loadLocaleMessages(i18n: NonLegacyI18n, locale: Locale) {
  // load locale messages
  const messages = await import(`../locales/${locale}.json`).then((r) => r.default || r);

  // set locale and locale message
  i18n.global.setLocaleMessage(locale, messages);

  return nextTick();
}
