import { defineConfig } from "windicss/helpers";

export default defineConfig({
  safelist: "animate-pulse",
  theme: {
    extend: {
      plugins: [require("windicss/plugin/forms")]
    }
  }
});
