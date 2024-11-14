// https://vitepress.dev/guide/custom-theme
import { h } from "vue";
import type { Theme } from "vitepress";
import BaseTheme from "vitepress/theme";
import "./style.css";

export default {
  extends: BaseTheme,
  Layout: () => {
    return h(BaseTheme.Layout, null, {
      // https://vitepress.dev/guide/extending-default-theme#layout-slots
    });
  }
} satisfies Theme;
