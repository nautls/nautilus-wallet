import { defineConfig } from "windicss/helpers";

export default defineConfig({
  theme: {
    extend: {
      fontFamily: {
        sans: ["FiraSans"],
        mono: ["RobotoMono"]
      },
      plugins: [require("windicss/plugin/forms")]
    }
  }
});
