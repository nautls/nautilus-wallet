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
    logo: { src: "/logo.svg", alt: "Nautilus Wallet Logo" },

    sidebar: [
      {
        text: "dApp Connector API",
        items: [
          {
            text: "Getting Started",
            link: "/dapp-connector/getting-started"
          },
          {
            text: "Connecting to a Wallet",
            link: "/dapp-connector/wallet-connection"
          },
          { text: "Signing a Transaction", link: "/dapp-connector/transaction-signing" },
          { text: "Signing Arbitrary Data", link: "/dapp-connector/data-signing" }
        ]
      }
    ],

    socialLinks: [{ icon: "github", link: "https://github.com/nautls/nautilus-wallet" }]
  }
});
