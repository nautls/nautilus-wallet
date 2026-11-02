import { createApp } from "vue";
import { setupApp } from "@/boot/commonSetup";
import { log } from "@/common/logger";
import { runMigrations } from "@/database/migrations";
import App from "./App.vue";
import { router } from "./router";

// keeps IndexedDB from being evicted under storage pressure
navigator.storage?.persist?.().catch((e) => log.error(e));

const [app] = await Promise.all([setupApp(createApp(App)), runMigrations()]);
app.use(router).mount("#app");
