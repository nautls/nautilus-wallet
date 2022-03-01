import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import store from "./store";
import VueFeather from "vue-feather";
import { wasmModule } from "./utils/wasm-module";
import PageTitle from "@/components/PageTitle.vue";
import ClickToCopy from "@/components/ClickToCopy.vue";
import ToolTip from "@/components/ToolTip.vue";
import DropDown from "@/components/DropDown.vue";
import LoadingModal from "@/components/LoadingModal.vue";
import LoadingIndicator from "@/components/LoadingIndicator.vue";
import WalletItem from "@/components/WalletItem.vue";
import DAppPlate from "@/components/DappPlate.vue";
import { filters } from "@/utils/globalFilters";
import { Inputitems, Modal, Slider, Switch, Config } from "@oruga-ui/oruga-next";
import { vueCleave } from "@/directives/cleave";
import { rpcHandler } from "@/background/rpcHandler";
import mdiVue from "mdi-vue/v3";
import { mdiIncognito } from "@mdi/js";

import "@/config/axiosConfig";

import "@/assets/styles/fonts.css";
import "@oruga-ui/oruga-next/dist/oruga.css";
import "windi.css";
import "@/assets/styles/main.css";

rpcHandler.start();
wasmModule.loadAsync();

const app = createApp(App);
app.config.globalProperties.$filters = filters;

app
  .use(store)
  .use(router)
  .use(Inputitems)
  .use(Modal)
  .use(Slider)
  .use(Switch)
  .use(Config, {
    switch: {
      checkCheckedClass: "bg-blue-600"
    }
  })
  .use(mdiVue, {
    icons: { mdiIncognitoCircle, mdiIncognito }
  })
  .directive("cleave", vueCleave)
  .component("vue-feather", VueFeather)
  .component("page-title", PageTitle)
  .component("click-to-copy", ClickToCopy)
  .component("tool-tip", ToolTip)
  .component("drop-down", DropDown)
  .component("loading-modal", LoadingModal)
  .component("loading-indicator", LoadingIndicator)
  .component("wallet-item", WalletItem)
  .component("dapp-plate", DAppPlate)
  .mount("#app");
