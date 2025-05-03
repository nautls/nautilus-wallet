import { defineConfig } from "vitepress";
import llmstxt from "vitepress-plugin-llms";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Nautilus Wallet",
  description: "Nautilus Technical Docs",
  cleanUrls: true,
  lastUpdated: true,
  lang: "en-US",
  head: [
    ["link", { rel: "icon", href: "/logo.svg" }] // favicon
  ],

  vite: {
    // @ts-expect-error vite version mismatch
    plugins: [llmstxt({ ignoreFiles: ["legal/*", "index.md"] })]
  },

  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    editLink: {
      pattern: "https://github.com/nautls/nautilus-wallet/edit/master/docs/:path"
    },
    outline: "deep",
    logo: { src: "/logo.svg", alt: "Nautilus Wallet Logo" },

    sidebar: [
      {
        text: "dApp Connector API",
        items: [
          { text: "API Overview", link: "/dapp-connector/api-overview" },
          { text: "Connecting to a Wallet", link: "/dapp-connector/wallet-connection" },
          { text: "Interacting with a Wallet", link: "/dapp-connector/wallet-interaction" }
        ]
      }
    ],

    socialLinks: [
      { icon: "github", link: "https://github.com/nautls/nautilus-wallet" },
      { icon: "x", link: "https://x.com/nautiluswallet" },
      { icon: "discord", link: "https://discord.gg/ergo-platform-668903786361651200" }
    ]
  }
});
