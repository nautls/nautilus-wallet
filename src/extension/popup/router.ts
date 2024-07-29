import { createRouter, createWebHashHistory, RouteRecordRaw } from "vue-router";

// Views
const addView = () => import("@/views/add/AddView.vue");
const nftGalleryView = () => import("@/views/NftGalleryView.vue");
const receiveView = () => import("@/views/ReceiveView.vue");
const addReadOnlyView = () => import("@/views/add/AddReadOnlyView.vue");
const restoreView = () => import("@/views/add/RestoreView.vue");
const addStandardView = () => import("@/views/add/AddStandardView.vue");
const sendView = () => import("@/views/SendView.vue");
const aboutView = () => import("@/views/AboutView.vue");
const settingsView = () => import("@/views/SettingsView.vue");
const connectionsView = () => import("@/views/connector/ConnectionsView.vue");
const dAppsView = () => import("@/views/DAppsView.vue");
const assetsView = () => import("@/views/AssetsView.vue");
const ledgerConnectView = () => import("@/views/add/ConnectLedgerView.vue");

// dApps
const walletOptimizationDApp = () =>
  import("@/dapps/wallet-optimization/WalletOptimizationDApp.vue");
const dAppsList = () => import("@/dapps/DappsList.vue");

const routes: Array<RouteRecordRaw> = [
  {
    path: "/",
    name: "assets-page",
    component: assetsView
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
    path: "/nft",
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
    path: "/connector/connections",
    name: "connector-connected",
    component: connectionsView
  },
  {
    path: "/wallet/settings",
    name: "wallet-settings",
    component: settingsView
  }
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes
});
