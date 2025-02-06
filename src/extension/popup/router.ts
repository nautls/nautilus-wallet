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
    meta: {
      fullPage: true,
      title: "Add Wallet",
      description: "Create, restore or connect Ergo Wallets"
    }
  },

  {
    path: "/add/restore",
    name: "restore-wallet",
    component: () => import("@/views/add/RestoreView.vue"),
    meta: {
      fullPage: true,
      title: "Restore Wallet",
      description: "Restore an existing Ergo Wallet"
    }
  },
  {
    path: "/add/new",
    name: "add-standard-wallet",
    component: () => import("@/views/add/AddStandardView.vue"),
    meta: {
      fullPage: true,
      title: "Create New Wallet",
      description: "Create a new Ergo Wallet"
    }
  },
  {
    path: "/add/hw/ledger",
    name: "add-hw-ledger",
    component: () => import("@/views/add/ConnectLedgerView.vue"),
    meta: {
      fullPage: true,
      title: "Connect Ledger Wallet",
      description: "Connect to a Ledger Hardware Wallet"
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
