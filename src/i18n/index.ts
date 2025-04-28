import { nextTick } from "vue";
import { createI18n } from "vue-i18n";
import type { Composer, Locale } from "vue-i18n";
import type EnglishMessages from "./locales/en-US.json";
import { russianPluralRules } from "./plural-rules/ru";

// import en locale dynamically to avoid the following vite warning: "en.json is dynamically
// imported by i18n.ts but also statically imported by i18n.ts, dynamic import will not move
// module into another chunk."
const enUS = await importLocale("en-US");

// Supported languages must be ordered by the most used to the least used.
// See https://www.ethnologue.com/insights/ethnologue200/ for reference.
export const SUPPORTED_LOCALES = ["en-US", "fr-FR", "pt-BR", "ru-RU", "de-DE", "id-ID"] as const;
const DEFAULT_LOCALE = "en-US" as const;

// Labels must be in the target language following the format: "Language (Country)", where
// "Country" is optional and must follow the ISO 3166-1 alpha-2 system (two letter country
// code). e.g. "English (US)", "Português (BR)"
export const LANGUAGE_LABELS = new Map<Locale, string>([
  ["en-US", "English (US)"], //         English (United States)
  ["fr-FR", "Français (FR)"], //        French (France)
  ["pt-BR", "Português (BR)"], //       Portuguese (Brazil)
  ["ru-RU", "Русский (RU)"], //         Russian (Russia)
  ["de-DE", "Deutsch (DE)"], //         German (Germany)
  ["id-ID", "Bahasa Indonesia (ID)"] // Indonesian (Indonesia)
]);

export type MessageSchema = typeof EnglishMessages;
export type Translator = Composer["t"];
export type DateFormatter = Composer["d"];

let _globalInstance: Composer;

export function setupI18n() {
  const i18n = createI18n({
    legacy: false,
    locale: DEFAULT_LOCALE,
    fallbackLocale: DEFAULT_LOCALE,
    messages: { [DEFAULT_LOCALE]: enUS },
    pluralRules: {
      "ru-RU": russianPluralRules
    },
    datetimeFormats: {
      [DEFAULT_LOCALE]: {
        long: { dateStyle: "long" },
        short: { dateStyle: "short" }
      }
    }
  });

  _globalInstance = i18n.global as Composer;
  return i18n;
}

export function getLocale(): Locale {
  return _globalInstance.locale.value as Locale;
}

export async function setLocale(locale: string): Promise<void> {
  const lang = fallback(locale, SUPPORTED_LOCALES) as Locale;

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

export function fallback(locale: string, availableLocales: readonly string[]): Locale {
  let match = availableLocales.includes(locale)
    ? locale
    : availableLocales.find((a) => locale.startsWith(a));
  if (match) return match as Locale;

  const segments = locale.split("-");
  if (segments.length) {
    const language = segments[0] + "-";
    match = availableLocales.find((a) => a.startsWith(language));
  }

  return (match ?? DEFAULT_LOCALE) as Locale;
}

async function importLocale(locale: Locale) {
  return import(`./locales/${locale}.json`).then((r) => r.default || r);
}
