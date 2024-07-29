import { createRouter, createWebHashHistory, RouteRecordRaw } from "vue-router";

// Views
const connectView = () => import("./views/ConnectView.vue");
const authView = () => import("./views/AuthView.vue");
const signDataView = () => import("./views/SignDataView.vue");
const signTxView = () => import("./views/SignTxConfirmView.vue");

const routes: Array<RouteRecordRaw> = [
  {
    path: "/connect",
    name: "connector-connect",
    component: connectView,
    meta: { title: "Access request", fullPage: true }
  },
  {
    path: "/sign/tx",
    name: "connector-sign-tx",
    component: signTxView,
    meta: { title: "Transaction signature" }
  },
  {
    path: "/sign/data",
    name: "connector-sign-data",
    component: signDataView,
    meta: { title: "Data signature" }
  },
  {
    path: "/auth",
    name: "connector-auth",
    component: authView,
    meta: { title: "Authorization" }
  }
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes
});
