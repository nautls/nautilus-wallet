import { createApp } from "vue";
import { setupApp } from "@/boot/commonSetup";
import App from "./App.vue";
import { router } from "./router";
import { registerRpcHooks } from "./rpc/uiRpcHandlers";

registerRpcHooks();
setupApp(createApp(App)).use(router).mount("#app");
