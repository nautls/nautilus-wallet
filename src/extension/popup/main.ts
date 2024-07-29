import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./router";
import { setupApp } from "@/boot/commonSetup";

setupApp(createApp(App)).use(router).mount("#app");
