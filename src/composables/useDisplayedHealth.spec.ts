import { effectScope, nextTick, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONNECTED_FOR, SETTLE_DELAY, SHOW_DELAY, useDisplayedHealth } from "./useDisplayedHealth";
import type { RelayHealth } from "./useRelayHealth";

function setup(initial: RelayHealth) {
  const health = ref<RelayHealth>(initial);
  const scope = effectScope();
  const shown = scope.run(() => useDisplayedHealth(health))!;
  const set = async (value: RelayHealth) => {
    health.value = value;
    await nextTick();
  };
  return { shown, set, scope };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useDisplayedHealth", () => {
  it("shows nothing when the relay is live within the show delay", async () => {
    const { shown, set } = setup("loading");
    vi.advanceTimersByTime(SHOW_DELAY - 1);
    await set("live");
    vi.advanceTimersByTime(SHOW_DELAY + SETTLE_DELAY + CONNECTED_FOR);
    expect(shown.value).toBe("live");
  });

  it("shows a problem after the delay, then connected for a while once it clears", async () => {
    const { shown, set } = setup("loading");
    vi.advanceTimersByTime(SHOW_DELAY);
    expect(shown.value).toBe("loading");

    await set("live");
    vi.advanceTimersByTime(SETTLE_DELAY - 1);
    expect(shown.value).toBe("loading");
    vi.advanceTimersByTime(1);
    expect(shown.value).toBe("connected");

    vi.advanceTimersByTime(CONNECTED_FOR);
    expect(shown.value).toBe("live");
  });

  it("keeps a shown problem through a short flap", async () => {
    const { shown, set } = setup("reconnecting");
    vi.advanceTimersByTime(SHOW_DELAY);

    await set("live");
    vi.advanceTimersByTime(SETTLE_DELAY - 1);
    await set("reconnecting");
    vi.advanceTimersByTime(SETTLE_DELAY);
    expect(shown.value).toBe("reconnecting");
  });

  it("moves between problems at once once one is shown", async () => {
    const { shown, set } = setup("loading");
    vi.advanceTimersByTime(SHOW_DELAY);
    await set("error");
    expect(shown.value).toBe("error");
  });

  it("replaces connected with a new problem at once", async () => {
    const { shown, set } = setup("reconnecting");
    vi.advanceTimersByTime(SHOW_DELAY);
    await set("live");
    vi.advanceTimersByTime(SETTLE_DELAY);
    expect(shown.value).toBe("connected");

    await set("reconnecting");
    expect(shown.value).toBe("reconnecting");
    vi.advanceTimersByTime(CONNECTED_FOR);
    expect(shown.value).toBe("reconnecting");
  });
});
