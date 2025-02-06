import { App } from "vue";
import { createPinia } from "pinia";

import "@/assets/styles/index.css";

export function setupApp(app: App): App {
  return app.use(createPinia());
}
