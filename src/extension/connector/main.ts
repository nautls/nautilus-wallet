import { createApp } from "vue";
import { setupApp } from "@/boot/commonSetup";
import { runMigrations } from "@/database/migrations";
import App from "./App.vue";
import { router } from "./router";
import { registerRpcHooks } from "./rpc/uiRpcHandlers";

await runMigrations();
registerRpcHooks();
setupApp(createApp(App)).use(router).mount("#app");
