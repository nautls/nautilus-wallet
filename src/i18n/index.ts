import { nextTick } from "vue";
import { createI18n } from "vue-i18n";
import type { Composer, Locale } from "vue-i18n";
import type NativeTokensMessages from "@/dapps/native-tokens/locales/en-US.json";
import type SigmaUsdMessages from "@/dapps/sigma-usd/locales/en-US.json";
import type WalletOptimizationMessages from "@/dapps/wallet-optimization/locales/en-US.json";
import type EnglishMessages from "./locales/en-US.json";
import { russianPluralRules } from "./plural-rules/ru";

// import en locale dynamically to avoid the following vite warning: "en.json is dynamically
// imported by i18n.ts but also statically imported by i18n.ts, dynamic import will not move
// module into another chunk."
const enUS = await importLocale("en-US");

// Supported languages must be ordered by the most used to the least used.
// See https://www.ethnologue.com/insights/ethnologue200/ for reference.
export const SUPPORTED_LOCALES = [
  "en-US",
  "zh-CN",
  "fr-FR",
  "pt-BR",
  "ru-RU",
  "id-ID",
  "ms-MS",
  "jv-JV",
  "de-DE"
] as const;
const DEFAULT_LOCALE = "en-US" as const;

// Labels must be in the target language following the format: "Language (Country)", where
// "Country" is optional and must follow the ISO 3166-1 alpha-2 system (two letter country
// code) if present. e.g. "English (US)", "Português (BR)"
export const LANGUAGE_LABELS = new Map<Locale, string>([
  ["en-US", "English (US)"], //           English (United States)
  ["zh-CN", "简体中文 (CN)"], //           Simplified Chinese (China)
  ["fr-FR", "Français (FR)"], //          French (France)
  ["pt-BR", "Português (BR)"], //         Portuguese (Brazil)
  ["ru-RU", "Русский (RU)"], //           Russian (Russia)
  ["id-ID", "Bahasa Indonesia (ID)"], //  Indonesian (Indonesia)
  ["ms-MS", "Melayu (MS)"], //            Melayu (Malaysian)
  ["jv-JV", "Basa Jawa (ID)"], //         Javanese (Javanese)
  ["de-DE", "Deutsch (DE)"] //            German (Germany)
]);

export type MessageSchema = typeof EnglishMessages &
  typeof SigmaUsdMessages &
  typeof WalletOptimizationMessages &
  typeof NativeTokensMessages;
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

/**
 * Translates using the global i18n instance. Meant for code that runs outside of
 * components' setup, like validation rules.
 */
export const gt = ((...args: unknown[]) =>
  (_globalInstance.t as (...args: unknown[]) => string)(...args)) as Translator;

export function getLocale(): Locale {
  return _globalInstance.locale.value as Locale;
}

export async function setLocale(locale: string): Promise<void> {
  const lang = fallback(locale, SUPPORTED_LOCALES) as Locale;

  if (!(lang in _globalInstance.messages)) {
    await loadLocale(lang);
  }

  // make sure already loaded scopes are also available in the new locale
  await Promise.all([...loadedScopes].map((scope) => loadScopeMessages(scope, lang)));

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

/**
 * Lazily loaded locale scopes. Each scope lives in `src/dapps/<scope>/locales/<locale>.json`
 * and is merged into the global messages when loaded, so keys keep their full path.
 */
const scopeLoaders = import.meta.glob<{ default: Record<string, unknown> }>(
  "@/dapps/*/locales/*.json"
);
const loadedScopes = new Set<string>();
const loadedScopeMessages = new Set<string>();

/**
 * Loads a scope's messages for the current and fallback locales. Meant to be awaited
 * before the scope's view renders, e.g. in a route's `beforeEnter` guard.
 */
export async function loadLocaleScope(scope: string): Promise<void> {
  loadedScopes.add(scope);
  const locales = new Set([DEFAULT_LOCALE, getLocale()]);
  await Promise.all([...locales].map((locale) => loadScopeMessages(scope, locale)));
}

async function loadScopeMessages(scope: string, locale: Locale): Promise<void> {
  const id = `${scope}/${locale}`;
  if (loadedScopeMessages.has(id)) return;

  const loader = scopeLoaders[`/src/dapps/${scope}/locales/${locale}.json`];
  if (!loader) return;

  const messages = await loader();
  _globalInstance.mergeLocaleMessage(locale, messages.default);
  loadedScopeMessages.add(id);
}

async function importLocale(locale: Locale) {
  return import(`./locales/${locale}.json`).then((r) => r.default || r);
}
