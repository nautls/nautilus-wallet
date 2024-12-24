import { Ref, ref, shallowRef } from "vue";
import { pausableWatch, StorageSerializers, toValue, tryOnScopeDispose } from "@vueuse/core";
import type {
  MaybeRefOrGetter,
  RemovableRef,
  StorageLikeAsync,
  UseStorageAsyncOptions
} from "@vueuse/core";
import { storage } from "webextension-polyfill";
import type { Storage } from "webextension-polyfill";
import { log } from "@/common/logger";

export type WebExtensionStorageOptions<T> = UseStorageAsyncOptions<T>;

const storageInterface: StorageLikeAsync = {
  removeItem(key: string) {
    return storage.local.remove(key);
  },
  setItem(key: string, value: string) {
    return storage.local.set({ [key]: value });
  },
  async getItem(key: string) {
    const storedData = await storage.local.get(key);
    return storedData[key] as string;
  }
};

export function useWebExtStorage(
  key: string,
  initialValue: MaybeRefOrGetter<string>,
  options?: UseStorageAsyncOptions<string>
): RemovableRef<string>;
export function useWebExtStorage(
  key: string,
  initialValue: MaybeRefOrGetter<boolean>,
  options?: UseStorageAsyncOptions<boolean>
): RemovableRef<boolean>;
export function useWebExtStorage(
  key: string,
  initialValue: MaybeRefOrGetter<number>,
  options?: UseStorageAsyncOptions<number>
): RemovableRef<number>;
export function useWebExtStorage<T>(
  key: string,
  initialValue: MaybeRefOrGetter<T>,
  options?: UseStorageAsyncOptions<T>
): RemovableRef<T>;
export function useWebExtStorage<T = unknown>(
  key: string,
  initialValue: MaybeRefOrGetter<null>,
  options?: UseStorageAsyncOptions<T>
): RemovableRef<T>;

/**
 * https://github.com/vueuse/vueuse/blob/658444bf9f8b96118dbd06eba411bb6639e24e88/packages/core/useStorageAsync/index.ts
 *
 * @param key
 * @param initialValue
 * @param options
 */
export function useWebExtStorage<T>(
  key: string,
  initialValue: MaybeRefOrGetter<T>,
  options: WebExtensionStorageOptions<T> = {}
): RemovableRef<T> {
  const {
    flush = "pre",
    deep = true,
    listenToStorageChanges = true,
    writeDefaults = true,
    mergeDefaults = false,
    shallow,
    eventFilter,
    onError = log.error
  } = options;

  const rawInit: T = toValue(initialValue);
  const type = guessSerializerType(rawInit);

  const data = (shallow ? shallowRef : ref)(initialValue) as Ref<T>;
  const serializer = options.serializer ?? StorageSerializers[type];

  async function read(event?: { key: string; newValue: string | null }) {
    if (event && event.key !== key) return;

    try {
      const rawValue = event ? event.newValue : await storageInterface.getItem(key);
      if (rawValue == null) {
        data.value = rawInit;
        if (writeDefaults && rawInit !== null)
          await storageInterface.setItem(key, await serializer.write(rawInit));
      } else if (mergeDefaults) {
        const value = (await serializer.read(rawValue)) as T;
        if (typeof mergeDefaults === "function") data.value = mergeDefaults(value, rawInit);
        else if (type === "object" && !Array.isArray(value))
          data.value = {
            ...(rawInit as Record<keyof unknown, unknown>),
            ...(value as Record<keyof unknown, unknown>)
          } as T;
        else data.value = value;
      } else {
        data.value = (await serializer.read(rawValue)) as T;
      }
    } catch (error) {
      onError(error);
    }
  }

  void read();

  async function write() {
    try {
      await (data.value == null
        ? storageInterface.removeItem(key)
        : storageInterface.setItem(key, await serializer.write(data.value)));
    } catch (error) {
      onError(error);
    }
  }

  const { pause: pauseWatch, resume: resumeWatch } = pausableWatch(data, write, {
    flush,
    deep,
    eventFilter
  });

  if (listenToStorageChanges) {
    const listener = async (changes: Record<string, Storage.StorageChange>) => {
      try {
        pauseWatch();
        for (const [key, change] of Object.entries(changes)) {
          await read({
            key,
            newValue: change.newValue as string | null
          });
        }
      } finally {
        resumeWatch();
      }
    };

    storage.onChanged.addListener(listener);

    tryOnScopeDispose(() => {
      storage.onChanged.removeListener(listener);
    });
  }

  return data as RemovableRef<T>;
}

// https://github.com/vueuse/vueuse/blob/658444bf9f8b96118dbd06eba411bb6639e24e88/packages/core/useStorage/guess.ts
export function guessSerializerType(rawInit: unknown) {
  return rawInit == null
    ? "any"
    : rawInit instanceof Set
      ? "set"
      : rawInit instanceof Map
        ? "map"
        : rawInit instanceof Date
          ? "date"
          : typeof rawInit === "boolean"
            ? "boolean"
            : typeof rawInit === "string"
              ? "string"
              : typeof rawInit === "object"
                ? "object"
                : Number.isNaN(rawInit)
                  ? "any"
                  : "number";
}
