import { App } from "vue";
import { createPinia } from "pinia";
import { setupI18n } from "@/i18n";

import "@/assets/styles/index.css";

export function setupApp(app: App): App {
  return app.use(createPinia()).use(setupI18n());
}
