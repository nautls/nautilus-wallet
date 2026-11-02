import { StorageSerializers } from "@vueuse/core";
import { storage } from "webextension-polyfill";
import type { Settings } from "@/stores/appStore";
import { DEFAULT_SETTINGS } from "@/constants/settings";

const serializer = StorageSerializers.object;
const SETTINGS_KEY = "settings";

/**
 * Get the settings from the storage
 */
export async function getSettings(): Promise<Settings> {
  const storedData = await storage.local.get(SETTINGS_KEY);
  const raw = storedData[SETTINGS_KEY] as string | undefined;
  const settings = raw ? serializer.read(raw) : {};

  return { ...DEFAULT_SETTINGS, ...settings };
}
