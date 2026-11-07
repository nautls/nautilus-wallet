import { effectScope, EffectScope, onScopeDispose, readonly, ref } from "vue";
import { log } from "@/common/logger";
import { walletsDbService } from "@/database/walletsDbService";

type UnlockSessionState = ReturnType<typeof createUnlockSession>;
let shared: { state: UnlockSessionState; scope: EffectScope; users: number } | undefined;

/**
 * Whether an unlock session is `active`, and whether one can be started (`available`),
 * kept up to date across pages. Every caller in a page shares the same state.
 */
export function useUnlockSession(): UnlockSessionState {
  if (!shared) {
    const scope = effectScope(true);
    shared = { state: scope.run(createUnlockSession)!, scope, users: 0 };
  }

  const current = shared;
  current.users++;
  onScopeDispose(() => {
    if (--current.users > 0) return;
    current.scope.stop();
    if (shared === current) shared = undefined;
  });

  return current.state;
}

function createUnlockSession() {
  const active = ref(false);
  const available = ref(false);
  const reloadActive = latestOnly(
    () => walletsDbService.isUnlocked(),
    (v) => (active.value = v)
  );
  const reloadAvailable = latestOnly(
    () => walletsDbService.canUnlock(),
    (v) => (available.value = v)
  );
  const reload = () => Promise.all([reloadActive(), reloadAvailable()]);

  const logged = (fn: () => Promise<unknown>) => () => void fn().catch((e) => log.error(e));
  logged(reload)();
  onScopeDispose(walletsDbService.onUnlockSessionChange(logged(reloadActive)));
  onScopeDispose(walletsDbService.onUnlockAvailabilityChange(logged(reloadAvailable)));

  return { active: readonly(active), available: readonly(available), reload };
}

/** Applies only the result of the latest call, so a slow earlier one can't overwrite it. */
function latestOnly<T>(load: () => Promise<T>, apply: (value: T) => void) {
  let latest = 0;
  return async () => {
    const call = ++latest;
    const value = await load();
    if (call === latest) apply(value);
  };
}
