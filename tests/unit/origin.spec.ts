import { describe, expect, it } from "vitest";
import { displayOrigin, hostOf, legacyHostToOrigin } from "@/common/origin";

describe("origin", () => {
  it("maps legacy hosts to https, but loopback ones to http", () => {
    expect(legacyHostToOrigin("dapp.io")).toBe("https://dapp.io");
    expect(legacyHostToOrigin("dapp.io:8443")).toBe("https://dapp.io:8443");
    expect(legacyHostToOrigin("localhost:5173")).toBe("http://localhost:5173");
    expect(legacyHostToOrigin("localhost")).toBe("http://localhost");
    expect(legacyHostToOrigin("127.0.0.1:3000")).toBe("http://127.0.0.1:3000");
    expect(legacyHostToOrigin("[::1]:3000")).toBe("http://[::1]:3000");
    expect(legacyHostToOrigin("localhost.dapp.io")).toBe("https://localhost.dapp.io");
  });

  it("returns the host signed by auth messages, whatever the scheme", () => {
    expect(hostOf("https://dapp.io")).toBe("dapp.io");
    expect(hostOf("http://dapp.io")).toBe("dapp.io");
    expect(hostOf("http://localhost:5173")).toBe("localhost:5173");
  });

  it("shows https origins as hosts, and anything else in full", () => {
    expect(displayOrigin("https://dapp.io")).toBe("dapp.io");
    expect(displayOrigin("http://dapp.io")).toBe("http://dapp.io");
    expect(displayOrigin("http://192.168.1.10:5173")).toBe("http://192.168.1.10:5173");
    expect(displayOrigin("not an origin")).toBe("not an origin");
  });
});
