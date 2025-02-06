import { createApp } from "vue";
import { setupApp } from "@/boot/commonSetup";
import App from "./App.vue";
import { router } from "./router";

setupApp(createApp(App)).use(router).mount("#app");
