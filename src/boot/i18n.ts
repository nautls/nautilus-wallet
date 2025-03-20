import { nextTick } from "vue";
import { createI18n } from "petite-vue-i18n";
import type { I18n, I18nOptions, Locale } from "petite-vue-i18n";
import en from "../locales/en.json";

type NonLegacyI18n = I18n<
  { en: typeof en },
  Record<string, unknown>,
  Record<string, unknown>,
  Locale,
  false
>;

export const SUPPORT_LOCALES = ["en", "pt"] as const;

let i18nInstance: NonLegacyI18n;

export function getLocale(): Locale {
  return i18nInstance.global.locale.value;
}

export function setLocale(locale: Locale): void {
  i18nInstance.global.locale.value = locale;
}

export function setupI18n() {
  const opt = {
    legacy: false,
    locale: "en",
    fallbackLocale: "en",
    messages: { en }
  } satisfies I18nOptions;

  return (i18nInstance = createI18n(opt));
}

export function setI18nLanguage(locale: Locale): void {
  setLocale(locale);
  document.querySelector("html")?.setAttribute("lang", locale);
}

export async function loadLocaleMessages(locale: Locale) {
  // load locale messages
  const messages = await import(`../locales/${locale}.json`).then((r) => r.default || r);

  // set locale and locale message
  i18nInstance.global.setLocaleMessage(locale, messages);

  return nextTick();
}
