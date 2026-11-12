import { describe, expect, it, vi } from "vitest";
import { NameLookupError, NameResolution } from "@/chains/ergo/services/nameService";
import { useNameLookups } from "./useNameLookups";

vi.mock("@/chains/ergo/services/graphQlService", () => ({ graphQLService: {} }));

const ADDRESS = "9gvDVNy1XvDeFoi4ZHn5v6u3tFRECMXGKbwuHbijJu6Z2hLQTQz";
const OTHER_ADDRESS = "9fJiyM6A77VGoN6rNy6dYzYdaJ5JqLKfChoX1QXCYS6kPs4bXBp";

function resolved(address: string): NameResolution {
  return { status: "resolved", name: "alice.erg", address, expiryHeight: 2_000_000, height: 1 };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe("useNameLookups", () => {
  it("should share one lookup between spellings of a name", async () => {
    const resolve = vi.fn(async () => resolved(ADDRESS));
    const names = useNameLookups({ resolve });

    await names.lookup(" Alice.ERG");

    expect(resolve).toHaveBeenCalledWith("alice.erg");
    expect(names.resolvedAddress("alice.erg")).toBe(ADDRESS);
    expect(names.get("ALICE.erg")).toMatchObject({ state: "done", addressChanged: false });
  });

  it("should flag an address that changed since it was shown", async () => {
    const resolve = vi.fn().mockResolvedValueOnce(resolved(ADDRESS));
    const names = useNameLookups({ resolve });
    await names.lookup("alice.erg");

    resolve.mockResolvedValueOnce(resolved(OTHER_ADDRESS));
    await names.lookup("alice.erg");
    expect(names.get("alice.erg")).toMatchObject({ state: "done", addressChanged: true });
    expect(names.resolvedAddress("alice.erg")).toBe(OTHER_ADDRESS);

    // once the new address was shown, looking up again confirms it
    resolve.mockResolvedValueOnce(resolved(OTHER_ADDRESS));
    await names.lookup("alice.erg");
    expect(names.get("alice.erg")).toMatchObject({ state: "done", addressChanged: false });
  });

  it("should keep the newest answer when lookups overlap", async () => {
    const slow = deferred<NameResolution>();
    const resolve = vi
      .fn()
      .mockReturnValueOnce(slow.promise)
      .mockResolvedValueOnce(resolved(OTHER_ADDRESS));
    const names = useNameLookups({ resolve });

    const first = names.lookup("alice.erg");
    await names.lookup("alice.erg");
    slow.resolve(resolved(ADDRESS));
    await first;

    expect(names.resolvedAddress("alice.erg")).toBe(OTHER_ADDRESS);
  });

  it("should keep the reason a lookup failed and resolve nothing", async () => {
    const resolve = vi
      .fn()
      .mockRejectedValueOnce(new NameLookupError("unverified", "mismatch"))
      .mockRejectedValueOnce(new Error("unexpected"));
    const names = useNameLookups({ resolve });

    await names.lookup("alice.erg");
    expect(names.get("alice.erg")).toEqual({ state: "failed", reason: "unverified" });

    await names.lookup("alice.erg");
    expect(names.get("alice.erg")).toEqual({ state: "failed", reason: "unavailable" });
    expect(names.resolvedAddress("alice.erg")).toBeUndefined();
  });
});
