import { hex, randomBytes } from "@fleet-sdk/crypto";
import { storage } from "webextension-polyfill";
import { MasterKeyHalves, MasterKeyRecord, WrappedKey } from "@/common/keystore";

/**
 * The master key of an unlock session is split between `storage.local` (the mask, on
 * disk) and `storage.session` (the masked key, in memory only), so a copy of either
 * the profile or the browser's memory alone can't rebuild it.
 */
const MASK_KEY = "unlockSession:mask";
const MASKED_KEY = "unlockSession:masked";
const ENABLED_KEY = "unlockSession:enabled";
const LOCAL_KEYS = [MASK_KEY, ENABLED_KEY];

/** `id` pairs the two halves, `fingerprint` ties them to the master key record they unlock. */
type MaskHalf = { id: string; mask: string };
type MaskedHalf = { id: string; key: string; check: WrappedKey; fingerprint: string };

/** `storage.session` is missing on older browsers. */
export function isUnlockSessionSupported(): boolean {
  return !!storage.session;
}

export async function isUnlockSessionEnabled(): Promise<boolean> {
  if (!isUnlockSessionSupported()) return false;

  const stored = await storage.local.get(ENABLED_KEY);
  return stored[ENABLED_KEY] !== false;
}

export async function setUnlockSessionEnabled(enabled: boolean) {
  await storage.local.set({ [ENABLED_KEY]: enabled });
  if (!enabled) await clearUnlockSession();
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

  await storage.local.set({ [MASK_KEY]: mask });
  await storage.session.set({ [MASKED_KEY]: masked });
}

/**
 * @returns the halves of `record`'s master key, `"none"` if no session is active, or
 * `"invalid"` for halves that don't belong together or to `record`, which may also be
 * a session start halfway through its writes. Never writes.
 */
export async function readUnlockSession(
  record: MasterKeyRecord
): Promise<MasterKeyHalves | "none" | "invalid"> {
  if (!isUnlockSessionSupported()) return "none";
  const [local, session] = await Promise.all([
    storage.local.get([MASK_KEY, ENABLED_KEY]),
    storage.session.get(MASKED_KEY)
  ]);
  const mask = local[MASK_KEY] as MaskHalf | undefined;
  const masked = session[MASKED_KEY] as MaskedHalf | undefined;
  if (!mask && !masked) return "none";

  if (
    local[ENABLED_KEY] === false ||
    !mask ||
    !masked ||
    mask.id !== masked.id ||
    masked.fingerprint !== fingerprint(record)
  ) {
    return "invalid";
  }

  return { mask: mask.mask, key: masked.key, check: masked.check };
}

export async function clearUnlockSession() {
  await Promise.all([storage.local.remove(MASK_KEY), storage.session?.remove(MASKED_KEY)]);
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
  return area === "local" && ENABLED_KEY in changes;
}

/** Changes on every wrap of the master key, so a new or re-wrapped key ends the session. */
const fingerprint = (record: MasterKeyRecord) => record.wrappedKey.iv;
