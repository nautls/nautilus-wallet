import {
  mdiAlertCircleOutline,
  mdiBackupRestore,
  mdiCheckAll,
  mdiCheckCircleOutline,
  mdiClose,
  mdiConsolidate,
  mdiEye,
  mdiEyeOff,
  mdiFilter,
  mdiFilterOff,
  mdiIncognito,
  mdiShieldCheckOutline,
  mdiSwapVerticalVariant,
  mdiWalletOutline,
  mdiWalletPlus
} from "@mdi/js";
import { Config, Inputitems, Modal, Slider, Switch } from "@oruga-ui/oruga-next";
import axios from "axios";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import JSONBig from "json-bigint";
import mdiVue from "mdi-vue/v3";
import { createApp } from "vue";
import VueFeather from "vue-feather";
import App from "./App.vue";
import { hasBrowserContext } from "./common/browser";
import store from "./store";
import router from "./router";
import { filters } from "@/common/globalFilters";
import AssetIcon from "@/components/AssetIcon.vue";
import ClickToCopy from "@/components/ClickToCopy.vue";
import DAppPlate from "@/components/DappPlate.vue";
import DropDown from "@/components/DropDown.vue";
import LoadingIndicator from "@/components/LoadingIndicator.vue";
import LedgerDevice from "@/components/LedgerDevice.vue";
import MdiIcon from "@/components/MdiIcon.vue";
import ToolTip from "@/components/ToolTip.vue";
import WalletItem from "@/components/WalletItem.vue";
import { vueCleave } from "@/directives/cleave";
import { startListening } from "@/rpc/uiRpcHandlers";

import "@/assets/styles/fonts.css";
import "@oruga-ui/oruga-next/dist/oruga.css";
// eslint-disable-next-line import/no-unresolved
import "windi.css";
import "@/assets/styles/main.css";

// eslint-disable-next-line import/no-named-as-default-member
dayjs.extend(relativeTime);
if (hasBrowserContext()) startListening();

axios.defaults.transformResponse = [
  (data) => {
    if (typeof data !== "string") return data;
    try {
      return JSONBig.parse(data);
    } catch {
      return data;
    }
  }
];

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
    mdiBackupRestore,
    mdiCheckAll,
    mdiEye,
    mdiEyeOff,
    mdiSwapVerticalVariant,
    mdiConsolidate,
    mdiCheckCircleOutline,
    mdiShieldCheckOutline
  }
};

const orugaSettings = {
  switch: {
    checkCheckedClass: "bg-blue-600"
  },
  modal: {
    overlayClass: "opacity-40",
    rootClass: "outline-none",
    contentClass: "z-10"
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
