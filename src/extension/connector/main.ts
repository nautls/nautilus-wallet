import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./router";
import { registerRpcHooks } from "./rpc/uiRpcHandlers";
import { setupApp } from "@/boot/commonSetup";

registerRpcHooks();
setupApp(createApp(App)).use(router).mount("#app");
