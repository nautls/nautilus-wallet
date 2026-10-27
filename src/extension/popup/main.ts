import { createApp } from "vue";
import { setupApp } from "@/boot/commonSetup";
import { log } from "@/common/logger";
import { runMigrations } from "@/database/migrations";
import App from "./App.vue";
import { router } from "./router";

// keeps IndexedDB from being evicted under storage pressure
navigator.storage?.persist?.().catch((e) => log.error(e));

await runMigrations();
setupApp(createApp(App)).use(router).mount("#app");
