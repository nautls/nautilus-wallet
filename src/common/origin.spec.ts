import { describe, expect, it } from "vitest";
import { isSecureOrigin } from "./origin";

describe("isSecureOrigin", () => {
  it("accepts https origins", () => {
    expect(isSecureOrigin("https://dapp.io")).toBe(true);
    expect(isSecureOrigin("https://dapp.io:8443")).toBe(true);
  });

  it("accepts loopback origins over http", () => {
    expect(isSecureOrigin("http://localhost:5173")).toBe(true);
    expect(isSecureOrigin("http://127.0.0.1")).toBe(true);
    expect(isSecureOrigin("http://[::1]:3000")).toBe(true);
  });

  it("rejects plain http and unparsable origins", () => {
    expect(isSecureOrigin("http://dapp.io")).toBe(false);
    expect(isSecureOrigin("http://localhost.dapp.io")).toBe(false);
    expect(isSecureOrigin("dapp.io")).toBe(false);
  });
});
