import { createRouter, createWebHashHistory, RouteRecordRaw } from "vue-router";
import AssetsView from "@/views/assets/AssetsView.vue";

const routes: Array<RouteRecordRaw> = [
  {
    path: "/",
    name: "assets",
    component: AssetsView
  },
  {
    path: "/add",
    name: "add-wallet",
    component: () => import("@/views/add/AddWalletIndexView.vue"),
    props: true,
    meta: { fullPage: true }
  },
  {
    path: "/add/new",
    name: "add-standard-wallet",
    component: () => import("@/views/add/CreateWalletView.vue"),
    meta: {
      fullPage: true,
      title: "Create New Wallet",
      description: "Create a new Ergo Wallet"
    }
  },
  {
    path: "/add/hw/ledger",
    name: "add-hw-ledger",
    component: () => import("@/views/add/LedgerConnectView.vue"),
    meta: {
      fullPage: true,
      title: "Connect Ledger Wallet",
      description: "Connect your Hardware Wallet"
    }
  },
  {
    path: "/add/import",
    name: "import-wallet",
    component: () => import("@/views/add/ImportWalletView.vue"),
    meta: {
      fullPage: true,
      title: "Import Wallet",
      description: "Import an existing Ergo Wallet"
    }
  },
  {
    path: "/history",
    name: "tx-history",
    component: () => import("@/views/TransactionHistoryView.vue")
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
    component: () => import("@/views/dapps/DAppsView.vue"),
    children: [
      {
        path: "",
        name: "dapps",
        component: () => import("@/views/dapps/DappsList.vue")
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
    path: "/settings",
    name: "wallet-settings",
    component: () => import("@/views/settings/SettingsView.vue")
  }
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes
});
