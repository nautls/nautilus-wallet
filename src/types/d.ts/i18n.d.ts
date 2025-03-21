// Interfaces need to imported first to be extended
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { DefineDateTimeFormat, DefineLocaleMessage, DefineNumberFormat } from "vue-i18n";
import type { MessageSchema, SUPPORTED_LOCALES } from "@/boot/i18n";

declare module "vue-i18n" {
  // define the locale messages schema
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface DefineLocaleMessage extends MessageSchema {}
  export type Locale = (typeof SUPPORTED_LOCALES)[number];

  // define the datetime format schema
  //   export interface DefineDateTimeFormat {
  //     short: {
  //       hour: "numeric";
  //       minute: "numeric";
  //       second: "numeric";
  //       timeZoneName: "short";
  //       timezone: string;
  //     };
  //   }

  // define the number format schema
  //   export interface DefineNumberFormat {
  //     currency: {
  //       style: "currency";
  //       currencyDisplay: "symbol";
  //       currency: string;
  //     };
  //   }
}
