import { acceptHMRUpdate, defineStore } from "pinia";
import { ref } from "vue";

/**
 * Having private state is not a good practice in reactive stores,
 * so we need this private store to hold not exported properties of
 * other stores.
 *
 * https://masteringpinia.com/blog/how-to-create-private-state-in-stores
 */
export const usePrivateStateStore = defineStore("metadata", () => {
  const loading = ref({ app: true });

  return { loading };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(usePrivateStateStore, import.meta.hot));
}
