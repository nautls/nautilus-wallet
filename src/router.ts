import { createRouter, createWebHashHistory, RouteRecordRaw } from "vue-router";
import Home from "@/views/Home.vue";
import About from "@/views/About.vue";
import ReadOnly from "@/views/ReadOnly.vue";
import Receive from "@/views/Receive.vue";
import AssetsPage from "@/views/AssetsPage.vue";

const routes: Array<RouteRecordRaw> = [
  {
    path: "/",
    name: "home-page",
    component: Home,
    meta: { fullPage: true },
  },
  {
    path: "/add/read-only",
    name: "add-read-only-wallet",
    component: ReadOnly,
    meta: { fullPage: true },
  },
  {
    path: "/assets",
    name: "assets-page",
    component: AssetsPage,
  },
  {
    path: "/receive",
    name: "receive-page",
    component: Receive,
  },
  {
    path: "/transactions",
    name: "tx-page",
    component: About,
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export default router;
