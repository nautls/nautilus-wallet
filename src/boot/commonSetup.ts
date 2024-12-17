import { Config, Inputitems, Modal, Slider, Switch } from "@oruga-ui/oruga-next";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { App } from "vue";
import VueFeather from "vue-feather";
import { createPinia } from "pinia";
import AssetIcon from "@/components/AssetIcon.vue";
import ClickToCopy from "@/components/ClickToCopy.vue";
import LoadingIndicator from "@/components/LoadingIndicator.vue";
import ToolTip from "@/components/ToolTip.vue";
import { vueCleave } from "@/directives/cleave";

import "@oruga-ui/oruga-next/dist/oruga.css";
import "windi.css";
import "@/assets/styles/main.css";

dayjs.extend(relativeTime);

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
    .directive("cleave", vueCleave)
    .component("vue-feather", VueFeather)
    .component("click-to-copy", ClickToCopy)
    .component("tool-tip", ToolTip)
    .component("loading-indicator", LoadingIndicator)
    .component("asset-icon", AssetIcon);
}
