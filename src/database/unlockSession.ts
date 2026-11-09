import { hex, randomBytes } from "@fleet-sdk/crypto";
import { alarms, storage } from "webextension-polyfill";
import { isSystemLockSupported } from "@/common/browser";
import { MasterKeyHalves, MasterKeyRecord, WrappedKey } from "@/common/keystore";

/**
 * The master key of an unlock session is split between `storage.local` (the mask, on
 * disk) and `storage.session` (the masked key, in memory only), so a copy of either
 * the profile or the browser's memory alone can't rebuild it.
 */
const MASK_KEY = "unlockSession:mask";
const MASKED_KEY = "unlockSession:masked";
const TIMEOUT_KEY = "unlockSession:timeout";
const USED_AT_KEY = "unlockSession:usedAt";
const LOCAL_KEYS = [MASK_KEY, TIMEOUT_KEY];
export const EXPIRY_ALARM = "unlockSession:expiry";

export const UNLOCK_TIMEOUTS = [
  "off",
  "5m",
  "15m",
  "30m",
  "1h",
  "4h",
  "systemLock",
  "browserRestart"
] as const;
export type UnlockTimeout = (typeof UNLOCK_TIMEOUTS)[number];
const DEFAULT_UNLOCK_TIMEOUT: UnlockTimeout = "browserRestart";

const MINUTE = 60 * 1000;
const IDLE_LIMITS: Partial<Record<UnlockTimeout, number>> = {
  "5m": 5 * MINUTE,
  "15m": 15 * MINUTE,
  "30m": 30 * MINUTE,
  "1h": 60 * MINUTE,
  "4h": 240 * MINUTE
};

/** `id` pairs the two halves, `fingerprint` ties them to the master key record they unlock. */
type MaskHalf = { id: string; mask: string };
type MaskedHalf = { id: string; key: string; check: WrappedKey; fingerprint: string };

/** `storage.session` is missing on older browsers. */
export function isUnlockSessionSupported(): boolean {
  return !!storage.session;
}

export async function isUnlockSessionEnabled(): Promise<boolean> {
  return (await getUnlockTimeout()) !== "off";
}

export async function getUnlockTimeout(): Promise<UnlockTimeout> {
  if (!isUnlockSessionSupported()) return "off";
  return readTimeout(await storage.local.get(TIMEOUT_KEY));
}

/** Turning it off ends the session, and so does a timeout shorter than its idle time. */
export async function setUnlockTimeout(timeout: UnlockTimeout) {
  if (timeout === "systemLock" && !isSystemLockSupported()) {
    throw Error("the system lock can't be detected");
  }

  await storage.local.set({ [TIMEOUT_KEY]: timeout });
  await expireUnlockSession(timeout);
}

/**
 * Restarts the countdown of a sliding timeout. Always records the use, so switching to
 * a timed option later counts from it.
 */
export async function touchUnlockSession() {
  const usedAt = Date.now();
  await storage.session.set({ [USED_AT_KEY]: usedAt });
  const timeout = await getUnlockTimeout();
  if (IDLE_LIMITS[timeout] !== undefined) await scheduleExpiry(usedAt, timeout);
}

/** Clears the session once it's turned off or idle for longer than its timeout. */
export async function expireUnlockSession(timeout?: UnlockTimeout) {
  timeout ??= await getUnlockTimeout();
  if (timeout === "off") return clearUnlockSession();

  const usedAt = (await storage.session.get(USED_AT_KEY))[USED_AT_KEY] as number | undefined;
  if (usedAt === undefined) return;
  if (isExpired(usedAt, timeout)) return clearUnlockSession();
  await scheduleExpiry(usedAt, timeout);
}

export async function endUnlockSessionOnSystemLock() {
  if ((await getUnlockTimeout()) === "systemLock") await clearUnlockSession();
}

/** Starts a session with fresh halves of `record`'s master key. Callers hold the wallets lock. */
export async function startUnlockSession(record: MasterKeyRecord, halves: MasterKeyHalves) {
  const id = hex.encode(randomBytes(16));
  const mask: MaskHalf = { id, mask: halves.mask };
  const masked: MaskedHalf = {
    id,
    key: halves.key,
    check: halves.check,
    fingerprint: fingerprint(record)
  };

  const usedAt = Date.now();
  await storage.local.set({ [MASK_KEY]: mask });
  await storage.session.set({ [MASKED_KEY]: masked, [USED_AT_KEY]: usedAt });
  await scheduleExpiry(usedAt, await getUnlockTimeout());
}

/**
 * @returns the halves of `record`'s master key, `"none"` if no session is active, or
 * `"invalid"` for halves that don't belong together or to `record`, which may also be
 * a session start halfway through its writes, or for an expired session. Never writes.
 */
export async function readUnlockSession(
  record: MasterKeyRecord
): Promise<MasterKeyHalves | "none" | "invalid"> {
  if (!isUnlockSessionSupported()) return "none";
  const [local, session] = await Promise.all([
    storage.local.get([MASK_KEY, TIMEOUT_KEY]),
    storage.session.get([MASKED_KEY, USED_AT_KEY])
  ]);
  const timeout = readTimeout(local);
  const mask = local[MASK_KEY] as MaskHalf | undefined;
  const masked = session[MASKED_KEY] as MaskedHalf | undefined;
  if (!mask && !masked) return "none";

  if (
    timeout === "off" ||
    !mask ||
    !masked ||
    mask.id !== masked.id ||
    masked.fingerprint !== fingerprint(record) ||
    isExpired(session[USED_AT_KEY] as number | undefined, timeout)
  ) {
    return "invalid";
  }

  return { mask: mask.mask, key: masked.key, check: masked.check };
}

export async function clearUnlockSession() {
  await Promise.all([
    storage.local.remove(MASK_KEY),
    storage.session?.remove([MASKED_KEY, USED_AT_KEY]),
    alarms?.clear(EXPIRY_ALARM)
  ]);
}

/** Deletes a mask left over from a previous browser run, useless without its other half. */
export async function clearStaleMask() {
  if (!isUnlockSessionSupported()) return storage.local.remove(MASK_KEY);
  const session = await storage.session.get(MASKED_KEY);
  if (!session[MASKED_KEY]) await storage.local.remove(MASK_KEY);
}

export function isUnlockSessionChange(changes: Record<string, unknown>, area: string): boolean {
  const keys = Object.keys(changes);
  if (area === "session") return keys.includes(MASKED_KEY);
  return area === "local" && keys.some((key) => LOCAL_KEYS.includes(key));
}

export function isUnlockSettingChange(changes: Record<string, unknown>, area: string): boolean {
  return area === "local" && TIMEOUT_KEY in changes;
}

function readTimeout(local: Record<string, unknown>): UnlockTimeout {
  return (local[TIMEOUT_KEY] as UnlockTimeout | undefined) ?? DEFAULT_UNLOCK_TIMEOUT;
}

function isExpired(usedAt: number | undefined, timeout: UnlockTimeout): boolean {
  const limit = IDLE_LIMITS[timeout];
  return limit !== undefined && (usedAt === undefined || Date.now() - usedAt >= limit);
}

/** The alarm only clears the session on time; reads check the expiry themselves. */
async function scheduleExpiry(usedAt: number, timeout: UnlockTimeout) {
  if (!alarms) return;
  const limit = IDLE_LIMITS[timeout];
  if (limit === undefined) await alarms.clear(EXPIRY_ALARM);
  else alarms.create(EXPIRY_ALARM, { when: usedAt + limit });
}

/** Changes on every wrap of the master key, so a new or re-wrapped key ends the session. */
const fingerprint = (record: MasterKeyRecord) => record.wrappedKey.iv;
