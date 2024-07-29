import { createApp } from "vue";
import App from "./App.vue";
import { setupApp } from "@/boot/commonSetup";
import { registerRpcHooks } from "@/rpc/uiRpcHandlers";

registerRpcHooks();
setupApp(createApp(App)).mount("#app");
