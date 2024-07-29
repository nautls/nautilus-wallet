import { createRouter, createWebHashHistory, RouteRecordRaw } from "vue-router";

// Views
const connectView = () => import("@/views/connector/ConnectView.vue");
const authView = () => import("@/views/connector/AuthView.vue");
const signDataView = () => import("@/views/connector/SignDataView.vue");
const signTxView = () => import("@/views/connector/SignTxConfirmView.vue");

const routes: Array<RouteRecordRaw> = [
  {
    path: "/connector/connect",
    name: "connector-connect",
    component: connectView,
    meta: { title: "Access request", fullPage: true }
  },
  {
    path: "/connector/sign/tx",
    name: "connector-sign-tx",
    component: signTxView,
    meta: { title: "Transaction signature" }
  },
  {
    path: "/connector/sign/data",
    name: "connector-sign-data",
    component: signDataView,
    meta: { title: "Data signature" }
  },
  {
    path: "/connector/auth",
    name: "connector-auth",
    component: authView,
    meta: { title: "Authorization" }
  }
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes
});
