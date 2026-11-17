import type { InjectionKey } from "vue";
import type { Settings } from "@/stores/appStore";

/** Read before mount so the first render uses stored values instead of defaults. */
export const PRELOADED_SETTINGS: InjectionKey<Settings> = Symbol("preloaded-settings");
