import { StorageSerializers } from "@vueuse/core";
import { omit } from "es-toolkit";
import { storage } from "webextension-polyfill";
import type { Settings } from "@/stores/appStore";
import { DEFAULT_SETTINGS } from "@/constants/settings";

const serializer = StorageSerializers.object;
const SETTINGS_KEY = "settings";

/** Keys of former settings, dropped wherever settings are read. */
const LEGACY_KEYS = ["graphQLServer", "zeroConf"];

/**
 * Get the settings from the storage
 */
export async function getSettings(): Promise<Settings> {
  const storedData = await storage.local.get(SETTINGS_KEY);
  const raw = storedData[SETTINGS_KEY] as string | undefined;
  const settings = raw ? serializer.read(raw) : {};

  return mergeSettings(settings, DEFAULT_SETTINGS);
}

/** Stored settings over the defaults, less the legacy keys either may still hold. */
export function mergeSettings(stored: Partial<Settings>, defaults: Settings): Settings {
  return omit({ ...defaults, ...stored } as Record<string, unknown>, LEGACY_KEYS) as Settings;
}
