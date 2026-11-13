import { reactive } from "vue";
import {
  NameLookupError,
  NameResolution,
  nameService,
  normalizeName
} from "@/chains/ergo/services/nameService";

export type NameLookup =
  | { state: "loading" }
  | { state: "done"; result: NameResolution; addressChanged: boolean }
  | { state: "failed"; reason: NameLookupError["reason"] };

export type NameLookups = ReturnType<typeof useNameLookups>;

/** Name lookups keyed by normalized name, so recipients with the same name share one. */
export function useNameLookups(service: Pick<typeof nameService, "resolve"> = nameService) {
  const lookups = reactive(new Map<string, NameLookup>());
  const latest = new Map<string, number>();
  /** The address last shown for each name, kept while later lookups load or fail. */
  const shown = new Map<string, string>();
  let counter = 0;

  function get(input: string): NameLookup | undefined {
    return lookups.get(normalizeName(input));
  }

  function resolvedAddress(input: string): string | undefined {
    const lookup = get(input);
    if (lookup?.state === "done" && lookup.result.status === "resolved") {
      return lookup.result.address;
    }
  }

  async function lookup(input: string): Promise<void> {
    const name = normalizeName(input);
    const id = ++counter;
    latest.set(name, id);
    lookups.set(name, { state: "loading" });

    let entry: NameLookup;
    try {
      const result = await service.resolve(name);
      const shownAddress = shown.get(name);
      const addressChanged =
        shownAddress !== undefined &&
        result.status === "resolved" &&
        result.address !== shownAddress;
      entry = { state: "done", result, addressChanged };
    } catch (e) {
      entry = { state: "failed", reason: e instanceof NameLookupError ? e.reason : "unavailable" };
    }

    // a slower, older lookup must not replace a newer one
    if (latest.get(name) !== id) return;

    lookups.set(name, entry);
    if (entry.state === "done" && entry.result.status === "resolved") {
      shown.set(name, entry.result.address);
    }
  }

  return { lookups, get, lookup, resolvedAddress };
}
