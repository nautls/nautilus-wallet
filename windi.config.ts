import { defineConfig } from "windicss/helpers";

export default defineConfig({
  shortcuts: {
    skeleton: "bg-gray-300 animate-pulse inline-block"
  },
  theme: {
    extend: {
      fontFamily: {
        sans: ["OpenSans"],
        mono: ["RobotoMono"]
      },
      plugins: [require("windicss/plugin/forms")]
    }
  }
});
