import { createRouter, createWebHashHistory, RouteRecordRaw } from "vue-router";
import AssetsView from "@/views/AssetsView.vue";

const routes: Array<RouteRecordRaw> = [
  {
    path: "/",
    name: "assets-page",
    component: AssetsView
  },
  {
    path: "/add",
    name: "add-wallet",
    component: () => import("@/views/add/AddView.vue"),
    props: true,
    meta: { fullPage: true, title: "Add new wallet" }
  },
  {
    path: "/add/read-only",
    name: "add-read-only-wallet",
    component: () => import("@/views/add/AddReadOnlyView.vue"),
    meta: { fullPage: true, title: "Add read-only wallet" }
  },
  {
    path: "/add/restore",
    name: "restore-wallet",
    component: () => import("@/views/add/RestoreView.vue"),
    meta: { fullPage: true, title: "Restore a standard wallet" }
  },
  {
    path: "/add/new",
    name: "add-standard-wallet",
    component: () => import("@/views/add/AddStandardView.vue"),
    meta: { fullPage: true, title: "Add new standard wallet" }
  },
  {
    path: "/add/hw/ledger",
    name: "add-hw-ledger",
    component: () => import("@/views/add/ConnectLedgerView.vue"),
    meta: { fullPage: true, title: "Connect a hardware wallet" }
  },
  {
    path: "/nft",
    name: "nft-gallery",
    component: () => import("@/views/NftGalleryView.vue")
  },
  {
    path: "/history",
    name: "tx-history",
    component: () => import("@/views/TransactionHistory.vue")
  },
  {
    path: "/receive",
    name: "receive-page",
    component: () => import("@/views/ReceiveView.vue")
  },
  {
    path: "/send",
    name: "send-page",
    component: () => import("@/views/SendView.vue")
  },
  {
    path: "/dapps",
    component: () => import("@/views/DAppsView.vue"),
    children: [
      {
        path: "",
        name: "dapps",
        component: () => import("@/dapps/DappsList.vue")
      },
      {
        path: "wallet-optimization",
        name: "wallet-optimization",
        component: () => import("@/dapps/wallet-optimization/WalletOptimizationDApp.vue")
      }
    ]
  },
  {
    path: "/about",
    name: "about-nautilus",
    component: () => import("@/views/AboutView.vue")
  },
  {
    path: "/connector/connections",
    name: "connector-connected",
    component: () => import("@/views/ConnectionsView.vue")
  },
  {
    path: "/wallet/settings",
    name: "wallet-settings",
    component: () => import("@/views/SettingsView.vue")
  }
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes
});
