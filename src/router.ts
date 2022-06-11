import { createRouter, createWebHashHistory, RouteRecordRaw } from "vue-router";
import LoadingView from "@/views/LoadingView.vue";
import AssetsView from "@/views/AssetsView.vue";
import AuthView from "@/views/connector/AuthView.vue";
import SignTxConfirmView from "@/views/connector/TxConfirm/SignTxConfirmView.vue";
import ConnectLedgerView from "@/views/add/ConnectLedgerView.vue";

const AddView = () => import("@/views/add/AddView.vue");
const NftGalleryView = () => import("@/views/NftGalleryView.vue");
const ReceiveView = () => import("@/views/ReceiveView.vue");
const AddReadOnlyView = () => import("@/views/add/AddReadOnlyView.vue");
const RestoreView = () => import("@/views/add/RestoreView.vue");
const AddStandardView = () => import("@/views/add/AddStandardView.vue");
const SendView = () => import("@/views/SendView.vue");
const AboutView = () => import("@/views/AboutView.vue");
const SettingsView = () => import("@/views/SettingsView.vue");
const ConnectionsView = () => import("@/views/connector/ConnectionsView.vue");

const routes: Array<RouteRecordRaw> = [
  {
    path: "/",
    name: "loading",
    component: LoadingView,
    meta: { fullPage: true }
  },
  {
    path: "/add",
    name: "add-wallet",
    component: AddView,
    props: true,
    meta: { fullPage: true, title: "Add new wallet" }
  },
  {
    path: "/add/read-only",
    name: "add-read-only-wallet",
    component: AddReadOnlyView,
    meta: { fullPage: true, title: "Add read-only wallet" }
  },
  {
    path: "/add/restore",
    name: "restore-wallet",
    component: RestoreView,
    meta: { fullPage: true, title: "Restore a standard wallet" }
  },
  {
    path: "/add/new",
    name: "add-standard-wallet",
    component: AddStandardView,
    meta: { fullPage: true, title: "Add new standard wallet" }
  },
  {
    path: "/add/hw/ledger",
    name: "add-hw-ledger",
    component: ConnectLedgerView,
    meta: { fullPage: true, title: "Connect a hardware wallet" }
  },
  {
    path: "/assets",
    name: "assets-page",
    component: AssetsView
  },
  {
    path: "/assets/nft",
    name: "nft-gallery",
    component: NftGalleryView
  },
  {
    path: "/receive",
    name: "receive-page",
    component: ReceiveView
  },
  {
    path: "/send",
    name: "send-page",
    component: SendView
  },
  {
    path: "/about",
    name: "about-nautilus",
    component: AboutView
  },
  {
    path: "/connector/auth",
    name: "connector-auth",
    component: AuthView,
    meta: { title: "Access request" }
  },
  {
    path: "/connector/connections",
    name: "connector-connected",
    component: ConnectionsView
  },
  {
    path: "/connector/sign/tx",
    name: "connector-sign-tx",
    component: SignTxConfirmView,
    meta: { title: "Transaction signature" }
  },
  {
    path: "/wallet/settings",
    name: "wallet-settings",
    component: SettingsView
  }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

export default router;
