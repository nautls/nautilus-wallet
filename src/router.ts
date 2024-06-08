import { createRouter, createWebHashHistory, RouteRecordRaw } from "vue-router";
import { defineAsyncComponent as asyncComponent } from "vue";
import LoadingView from "@/views/LoadingView.vue";

// Views
const addView = asyncComponent(() => import("@/views/add/AddView.vue"));
const nftGalleryView = asyncComponent(() => import("@/views/NftGalleryView.vue"));
const receiveView = asyncComponent(() => import("@/views/ReceiveView.vue"));
const addReadOnlyView = asyncComponent(() => import("@/views/add/AddReadOnlyView.vue"));
const restoreView = asyncComponent(() => import("@/views/add/RestoreView.vue"));
const addStandardView = asyncComponent(() => import("@/views/add/AddStandardView.vue"));
const sendView = asyncComponent(() => import("@/views/SendView.vue"));
const aboutView = asyncComponent(() => import("@/views/AboutView.vue"));
const settingsView = asyncComponent(() => import("@/views/SettingsView.vue"));
const connectionsView = asyncComponent(() => import("@/views/connector/ConnectionsView.vue"));
const dAppsView = asyncComponent(() => import("@/views/DAppsView.vue"));
const connectView = asyncComponent(() => import("@/views/connector/ConnectView.vue"));
const assetsView = asyncComponent(() => import("@/views/AssetsView.vue"));
const authView = asyncComponent(() => import("@/views/connector/AuthView.vue"));
const signTxView = asyncComponent(() => import("@/views/connector/SignTxConfirmView.vue"));
const ledgerConnectView = asyncComponent(() => import("@/views/add/ConnectLedgerView.vue"));

// dApps
const walletOptimizationDApp = asyncComponent(
  () => import("@/dapps/wallet-optimization/WalletOptimizationDApp.vue")
);
const dAppsList = asyncComponent(() => import("@/dapps/DappsList.vue"));

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
    component: addView,
    props: true,
    meta: { fullPage: true, title: "Add new wallet" }
  },
  {
    path: "/add/read-only",
    name: "add-read-only-wallet",
    component: addReadOnlyView,
    meta: { fullPage: true, title: "Add read-only wallet" }
  },
  {
    path: "/add/restore",
    name: "restore-wallet",
    component: restoreView,
    meta: { fullPage: true, title: "Restore a standard wallet" }
  },
  {
    path: "/add/new",
    name: "add-standard-wallet",
    component: addStandardView,
    meta: { fullPage: true, title: "Add new standard wallet" }
  },
  {
    path: "/add/hw/ledger",
    name: "add-hw-ledger",
    component: ledgerConnectView,
    meta: { fullPage: true, title: "Connect a hardware wallet" }
  },
  {
    path: "/assets",
    name: "assets-page",
    component: assetsView
  },
  {
    path: "/assets/nft",
    name: "nft-gallery",
    component: nftGalleryView
  },
  {
    path: "/receive",
    name: "receive-page",
    component: receiveView
  },
  {
    path: "/send",
    name: "send-page",
    component: sendView
  },
  {
    path: "/dapps",
    component: dAppsView,
    children: [
      {
        path: "",
        name: "dapps",
        component: dAppsList
      },
      {
        path: "wallet-optimization",
        name: "wallet-optimization",
        component: walletOptimizationDApp
      }
    ]
  },
  {
    path: "/about",
    name: "about-nautilus",
    component: aboutView
  },
  {
    path: "/connector/connect",
    name: "connector-connect",
    component: connectView,
    meta: { title: "Access request" }
  },
  {
    path: "/connector/connections",
    name: "connector-connected",
    component: connectionsView
  },
  {
    path: "/connector/sign/tx",
    name: "connector-sign-tx",
    component: signTxView,
    meta: { title: "Transaction signature" }
  },
  {
    path: "/connector/auth",
    name: "connector-auth",
    component: authView,
    meta: { title: "Authorization" }
  },
  {
    path: "/wallet/settings",
    name: "wallet-settings",
    component: settingsView
  }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

export default router;
