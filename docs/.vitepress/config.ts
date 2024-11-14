import { defineConfig } from "vitepress";

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
        base: "/dapp-connector/",
        items: [
          {
            text: "API Overview",
            link: "api-overview"
          },
          {
            text: "Connecting to a Wallet",
            link: "wallet-connection"
          },
          {
            text: "Interacting with a Wallet",
            link: "wallet-interaction"
          }
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
