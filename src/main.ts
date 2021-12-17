import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import store from "./store";
import VueFeather from "vue-feather";
import { WasmModule } from "./wasm-module";
import PageTitle from "@/components/PageTitle.vue";
import ClickToCopy from "@/components/ClickToCopy.vue";
import ToolTip from "@/components/ToolTip.vue";
import axios from "axios";
import JSONBigInt from "json-bigint";
import { filters } from "@/utils/globalFilters";
// import { Tooltip } from "@oruga-ui/oruga-next";
// import "@oruga-ui/oruga-next/dist/oruga.css";
import "windi.css";
import "@/assets/styles/main.css";

WasmModule.loadAsync();

axios.defaults.transformResponse = [
  data => {
    if (typeof data === "string") {
      try {
        data = JSONBigInt.parse(data);
      } catch (e) {
        console.error(e);
        return data;
      }
    }
    return data;
  }
];

const app = createApp(App);
app.config.globalProperties.$filters = filters;
app
  .use(store)
  .use(router)
  .component("vue-feather", VueFeather)
  .component("page-title", PageTitle)
  .component("click-to-copy", ClickToCopy)
  .component("tool-tip", ToolTip)
  .mount("#app");
