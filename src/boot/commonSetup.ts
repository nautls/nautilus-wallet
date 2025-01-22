import { App } from "vue";
import { createPinia } from "pinia";

import "@oruga-ui/oruga-next/dist/oruga.css";
import "@/assets/styles/main.css";
import "@/assets/index.css";

export function setupApp(app: App): App {
  return app.use(createPinia());
}
