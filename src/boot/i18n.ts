import { nextTick } from "vue";
import { createI18n } from "vue-i18n";
import type { I18n, Locale } from "vue-i18n";
import type EnglishMessages from "@/locales/en.json";

// import en locale dynamically to avoid the following vite warning:
//
// en.json is dynamically imported by i18n.ts but also statically imported
// by i18n.ts, dynamic import will not move module into another chunk.
const en = await importLocale("en");

// Change the following line when adding more locales
export const SUPPORTED_LOCALES = ["en", "pt"] as const;

export type MessageSchema = typeof EnglishMessages;

type LocaleData = Record<string, unknown>;
let i18nInstance: I18n<LocaleData, LocaleData, LocaleData, Locale, false>;

export function setupI18n() {
  return (i18nInstance = createI18n({
    legacy: false,
    locale: "en",
    fallbackLocale: "en",
    messages: { en }
  }));
}

export function getLocale(): Locale {
  return i18nInstance.global.locale.value as Locale;
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
  return import(`@/locales/${locale}.json`).then((r) => r.default || r);
}
