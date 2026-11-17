import { App } from "vue";
import { createPinia } from "pinia";
import { log } from "@/common/logger";
import { getSettings } from "@/extension/background/settings";
import { setLocale, setupI18n } from "@/i18n";
import { PRELOADED_SETTINGS } from "./preload";

import "@/assets/styles/index.css";

export async function setupApp(app: App): Promise<App> {
  app.use(createPinia()).use(setupI18n());

  const settings = await getSettings().catch((e) => {
    log.error(e);
    return undefined;
  });
  if (settings) app.provide(PRELOADED_SETTINGS, settings);

  const locale = settings?.locale;
  await setLocale(locale && locale !== "auto" ? locale : navigator.language);

  return app;
}
