import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import store from "./store";
import VueFeather from "vue-feather";
import { wasmModule } from "./utils/wasm-module";
import ClickToCopy from "@/components/ClickToCopy.vue";
import ToolTip from "@/components/ToolTip.vue";
import DropDown from "@/components/DropDown.vue";
import LoadingIndicator from "@/components/LoadingIndicator.vue";
import WalletItem from "@/components/WalletItem.vue";
import DAppPlate from "@/components/DappPlate.vue";
import LedgerDevice from "@/components/LedgerDevice.vue";
import MdiIcon from "@/components/MdiIcon.vue";
import AssetIcon from "@/components/AssetIcon.vue";
import { filters } from "@/utils/globalFilters";
import { Inputitems, Modal, Slider, Switch, Config } from "@oruga-ui/oruga-next";
import { vueCleave } from "@/directives/cleave";
import { rpcHandler } from "@/background/rpcHandler";
import mdiVue from "mdi-vue/v3";
import {
  mdiIncognito,
  mdiFilter,
  mdiFilterOff,
  mdiAlertCircleOutline,
  mdiClose,
  mdiWalletPlus,
  mdiWalletOutline,
  mdiBackupRestore
} from "@mdi/js";
import { hasBrowserContext } from "./utils/browserApi";

import "@/config/axiosConfig";

import "@/assets/styles/fonts.css";
import "@oruga-ui/oruga-next/dist/oruga.css";
import "windi.css";
import "@/assets/styles/main.css";

if (hasBrowserContext()) {
  rpcHandler.start();
}
wasmModule.loadAsync();

const app = createApp(App);
app.config.globalProperties.$filters = filters;

const mdiSettings = {
  icons: {
    mdiIncognito,
    mdiFilter,
    mdiFilterOff,
    mdiAlertCircleOutline,
    mdiClose,
    mdiWalletPlus,
    mdiWalletOutline,
    mdiBackupRestore
  }
};

const orugaSettings = {
  switch: {
    checkCheckedClass: "bg-blue-600"
  },
  modal: {
    overlayClass: "opacity-40"
  }
};

app
  .use(store)
  .use(router)
  .use(Inputitems)
  .use(Modal)
  .use(Slider)
  .use(Switch)
  .use(Config, orugaSettings)
  .use(mdiVue, mdiSettings)
  .directive("cleave", vueCleave)
  .component("vue-feather", VueFeather)
  .component("click-to-copy", ClickToCopy)
  .component("tool-tip", ToolTip)
  .component("drop-down", DropDown)
  .component("loading-indicator", LoadingIndicator)
  .component("wallet-item", WalletItem)
  .component("ledger-device", LedgerDevice)
  .component("dapp-plate", DAppPlate)
  .component("mdi-icon", MdiIcon)
  .component("asset-icon", AssetIcon)
  .mount("#app");
