import { createRouter, createWebHashHistory, RouteRecordRaw } from "vue-router";

const routes: Array<RouteRecordRaw> = [
  {
    path: "/connect",
    name: "connector-connect",
    component: () => import("./views/ConnectView.vue"),
    meta: { title: "Access request", fullPage: true }
  },
  {
    path: "/sign/tx",
    name: "connector-sign-tx",
    component: () => import("./views/SignTxConfirmView.vue"),
    meta: { title: "Transaction signature" }
  },
  {
    path: "/sign/data",
    name: "connector-sign-data",
    component: () => import("./views/DataSignView.vue"),
    meta: { title: "Data signature" }
  },
  {
    path: "/auth",
    name: "connector-auth",
    component: () => import("./views/AuthView.vue"),
    meta: { title: "Authorization" }
  }
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes
});
