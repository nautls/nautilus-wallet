import { nextTick } from "vue";
import { createI18n } from "vue-i18n";
import type { Composer, I18n, Locale } from "vue-i18n";
import type EnglishMessages from "@/locales/en.json";

// import en locale dynamically to avoid the following vite warning: "en.json
// is dynamically imported by i18n.ts but also statically imported by i18n.ts,
// dynamic import will not move module into another chunk."
const en = await importLocale("en");

// Change the following line when adding more locales
export const SUPPORTED_LOCALES = ["en", "pt"] as const;

type NonLegacyI18n = I18n<LocaleData, LocaleData, LocaleData, Locale, false>;
type LocaleData = Record<string, unknown>;

export type MessageSchema = typeof EnglishMessages;
export type Translator = NonLegacyI18n["global"]["t"];
export type DateFormatter = NonLegacyI18n["global"]["d"];

let _globalInstance: Composer;

export function setupI18n() {
  const i18n = createI18n({
    legacy: false,
    locale: "en",
    fallbackLocale: "en",
    messages: { en },
    datetimeFormats: {
      en: { long: { dateStyle: "long" }, short: { dateStyle: "short" } }
    }
  });

  _globalInstance = i18n.global as Composer;
  return i18n;
}

export function getLocale(): Locale {
  return _globalInstance.locale.value as Locale;
}

export async function setLocale(locale: string): Promise<void> {
  const lang =
    SUPPORTED_LOCALES.find((l) => l === locale) ?? // tries to match the exact locale
    SUPPORTED_LOCALES.find((l) => locale.startsWith(l)) ?? // tries to match the locale prefix
    "en"; // default to English

  if (!(lang in _globalInstance.messages)) {
    await loadLocale(lang);
  }

  _globalInstance.locale.value = lang;
  document.querySelector("html")?.setAttribute("lang", lang);
}

async function loadLocale(locale: Locale) {
  const messages = await importLocale(locale);
  _globalInstance.setLocaleMessage(locale, messages);
  return nextTick();
}

async function importLocale(locale: Locale) {
  return import(`@/locales/${locale}.json`).then((r) => r.default || r);
}
