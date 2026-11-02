import { App } from "vue";
import { createPinia } from "pinia";
import { log } from "@/common/logger";
import { getSettings } from "@/extension/background/settings";
import { setLocale, setupI18n } from "@/i18n";

import "@/assets/styles/index.css";

export async function setupApp(app: App): Promise<App> {
  app.use(createPinia()).use(setupI18n());

  await setLocale(await getPreferredLocale());

  return app;
}

async function getPreferredLocale(): Promise<string> {
  try {
    const { locale } = await getSettings();
    if (locale && locale !== "auto") return locale;
  } catch (e) {
    log.error(e);
  }

  return navigator.language;
}
