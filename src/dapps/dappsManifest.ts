export type DAppManifestItem = {
  name: string;
  icon: string;
  path: string;
};

export const dappsManifest: DAppManifestItem[] = [
  {
    name: "Wallet Optimization",
    icon: "optimizer.svg",
    path: "/dapps/wallet-optimization"
  }
];
