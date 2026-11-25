import { describe, expect, it, vi } from "vitest";
import type { Settings } from "@/stores/appStore";
import { DEFAULT_SETTINGS } from "@/constants/settings";
import { mergeSettings } from "./settings";

vi.mock("webextension-polyfill", () => ({ storage: { local: {} } }));

const legacy = { graphQLServer: "https://gql.example", zeroConf: true } as Partial<Settings>;

describe("mergeSettings", () => {
  it("should drop legacy keys from the stored settings", () => {
    const merged = mergeSettings({ ...legacy, hideBalances: true }, DEFAULT_SETTINGS);

    expect(merged).not.toHaveProperty("graphQLServer");
    expect(merged).not.toHaveProperty("zeroConf");
    expect(merged.hideBalances).toBe(true);
    expect(merged.relayUrl).toBe(DEFAULT_SETTINGS.relayUrl);
  });

  // pages merge over settings preloaded by `getSettings`, which may still hold them
  it("should drop legacy keys from the defaults", () => {
    const merged = mergeSettings({}, { ...DEFAULT_SETTINGS, ...legacy } as Settings);
    expect(merged).not.toHaveProperty("graphQLServer");
  });
});
