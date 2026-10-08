/* eslint-disable @typescript-eslint/no-explicit-any */
// Globals injected by Nautilus into dApp pages (see src/extension/content-scripts/injected.ts).
interface Window {
  ergoConnector: { nautilus: any; [key: string]: any };
  ergo?: any;
  ergo_request_read_access?: () => Promise<boolean>;
  ergo_check_read_access?: () => Promise<boolean>;
}
