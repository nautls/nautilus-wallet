// Interfaces need to imported first to be extended
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { DefineDateTimeFormat, DefineLocaleMessage, DefineNumberFormat } from "vue-i18n";
import type { MessageSchema, SUPPORTED_LOCALES } from "@/i18n";

declare module "vue-i18n" {
  // define the locale messages schema
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface DefineLocaleMessage extends MessageSchema {}
  export type Locale = (typeof SUPPORTED_LOCALES)[number];
}
