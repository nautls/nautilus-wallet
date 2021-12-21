import { defineConfig } from "windicss/helpers";

export default defineConfig({
  theme: {
    extend: {
      fontFamily: {
        sans: ["FiraSans"],
        mono: ["FiraMono"]
      },
      plugins: [require("windicss/plugin/forms")]
    }
  }
});
