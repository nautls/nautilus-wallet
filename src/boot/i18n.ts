import { nextTick } from "vue";
import { createI18n } from "vue-i18n";
import type { I18n, I18nOptions, Locale } from "vue-i18n";
import type English from "../locales/en.json";

// import en locale dynamically to avoid the following vite warning:
//
// en.json is dynamically imported by i18n.ts but also statically imported
// by i18n.ts, dynamic import will not move module into another chunk.
const en = await importLocale("en");

type NonLegacyI18n = I18n<
  { en: typeof English },
  Record<string, unknown>,
  Record<string, unknown>,
  Locale,
  false
>;

export const SUPPORTED_LOCALES = ["en", "pt"] as const;

let i18nInstance: NonLegacyI18n;

export function setupI18n() {
  const opt = {
    legacy: false,
    locale: "en",
    fallbackLocale: "en",
    messages: { en }
  } satisfies I18nOptions;

  return (i18nInstance = createI18n(opt));
}

export function getLocale(): Locale {
  return i18nInstance.global.locale.value;
}

export async function setLocale(locale: Locale): Promise<void> {
  if (!(locale in i18nInstance.global.messages)) {
    await loadLocale(locale);
  }

  i18nInstance.global.locale.value = locale;
  document.querySelector("html")?.setAttribute("lang", locale);
}

async function loadLocale(locale: Locale) {
  const messages = await importLocale(locale);
  i18nInstance.global.setLocaleMessage(locale, messages);
  return nextTick();
}

async function importLocale(locale: Locale) {
  return import(`../locales/${locale}.json`).then((r) => r.default || r);
}
