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
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import mdiVue from "mdi-vue/v3";
import { App } from "vue";
import VueFeather from "vue-feather";
import { createPinia } from "pinia";
import AssetIcon from "@/components/AssetIcon.vue";
import ClickToCopy from "@/components/ClickToCopy.vue";
import DropDown from "@/components/DropDown.vue";
import LoadingIndicator from "@/components/LoadingIndicator.vue";
import LedgerDevice from "@/components/LedgerDevice.vue";
import MdiIcon from "@/components/MdiIcon.vue";
import ToolTip from "@/components/ToolTip.vue";
import { vueCleave } from "@/directives/cleave";

import "@oruga-ui/oruga-next/dist/oruga.css";
import "windi.css";
import "@/assets/styles/main.css";

dayjs.extend(relativeTime);

const MDI_SETTINGS = {
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

const ORUGA_SETTINGS = {
  switch: {
    checkCheckedClass: "bg-blue-600"
  },
  modal: {
    overlayClass: "opacity-40",
    rootClass: "outline-none",
    contentClass: "z-10"
  }
};

export function setupApp(app: App): App {
  return app
    .use(createPinia())
    .use(Inputitems)
    .use(Modal)
    .use(Slider)
    .use(Switch)
    .use(Config, ORUGA_SETTINGS)
    .use(mdiVue, MDI_SETTINGS)
    .directive("cleave", vueCleave)
    .component("vue-feather", VueFeather)
    .component("click-to-copy", ClickToCopy)
    .component("tool-tip", ToolTip)
    .component("drop-down", DropDown)
    .component("loading-indicator", LoadingIndicator)
    .component("ledger-device", LedgerDevice)
    .component("mdi-icon", MdiIcon)
    .component("asset-icon", AssetIcon);
}
