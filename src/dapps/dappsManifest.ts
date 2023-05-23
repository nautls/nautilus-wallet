type DAppManifestIcon = {
  name: string;
  source: "mdi" | "file";
  color?: string;
};

export type DAppManifestItem = {
  name: string;
  icon: DAppManifestIcon;
  path: string;
};

export const dappsManifest: DAppManifestItem[] = [
  {
    name: "Wallet Optimization",
    icon: { name: "consolidate", source: "mdi", color: "text-purple-500" },
    path: "/dapps/wallet-optimization"
  }
];
