import { getCurrentInstance } from "vue";

getCurrentInstance()?.appContext.config.globalProperties; // .$context = "popup";

export function useGlobalProperties() {}
