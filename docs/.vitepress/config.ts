import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Nautilus Wallet",
  description: "Nautilus Technical Docs",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
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
