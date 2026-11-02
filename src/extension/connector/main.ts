import { createApp } from "vue";
import { setupApp } from "@/boot/commonSetup";
import { runMigrations } from "@/database/migrations";
import App from "./App.vue";
import { router } from "./router";
import { registerRpcHooks } from "./rpc/uiRpcHandlers";

const [app] = await Promise.all([setupApp(createApp(App)), runMigrations()]);
registerRpcHooks();
app.use(router).mount("#app");
