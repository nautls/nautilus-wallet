import { App } from "vue";
import { createPinia } from "pinia";
import { Config, Inputitems, Modal } from "@oruga-ui/oruga-next";

import "@oruga-ui/oruga-next/dist/oruga.css";
import "@/assets/styles/main.css";
import "@/assets/index.css";

const ORUGA_SETTINGS = {
  modal: {
    overlayClass: "opacity-40",
    rootClass: "outline-none",
    contentClass: "z-10"
  }
};

export function setupApp(app: App): App {
  return app.use(createPinia()).use(Inputitems).use(Modal).use(Config, ORUGA_SETTINGS);
}
