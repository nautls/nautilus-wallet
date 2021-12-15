import { defineConfig } from "windicss/helpers";

export default defineConfig({
  theme: {
    extend: {
      plugins: [require("windicss/plugin/forms")],
    },
  },
});
