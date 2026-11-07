import { vi } from "vitest";

vi.mock("@/common/logger", () => {
  const silent = () => vi.fn((...data: unknown[]) => data[0]);
  return { log: { info: silent(), debug: silent(), error: silent(), warn: silent() } };
});
