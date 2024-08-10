import { acceptHMRUpdate, defineStore } from "pinia";
import { computed, onMounted, onUnmounted } from "vue";
import { useStorage } from "@vueuse/core";
import { HEIGHT_CHECK_INTERVAL } from "../constants/intervals";
import { graphQLService } from "@/chains/ergo/services/graphQlService";

const usePrivateState = defineStore("_chain", () => {
  const state = useStorage("ergoChainState", { height: 0 });
  return { state };
});

export const useChainStore = defineStore("chain", () => {
  const privateState = usePrivateState();
  let intervalId: ReturnType<typeof setInterval> | undefined;
  let fetchingHeight = false;

  onMounted(async () => {
    await fetchHeight();
    intervalId = setInterval(fetchHeight, HEIGHT_CHECK_INTERVAL);
  });

  onUnmounted(() => {
    if (intervalId) clearInterval(intervalId);
  });

  const height = computed(() => privateState.state.height);

  async function fetchHeight() {
    if (fetchingHeight) return;
    fetchingHeight = true;

    const height = await graphQLService.getHeight();
    if (height && height > privateState.state.height) {
      privateState.state.height = height;
    }

    fetchingHeight = false;
  }

  return { height };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useChainStore, import.meta.hot));
  import.meta.hot.accept(acceptHMRUpdate(usePrivateState, import.meta.hot));
}
