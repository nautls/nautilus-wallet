import { computed, onMounted, onUnmounted } from "vue";
import { BOX_VALUE_PER_BYTE } from "@fleet-sdk/core";
import { acceptHMRUpdate, defineStore } from "pinia";
import { graphQLService } from "@/chains/ergo/services/graphQlService";
import { useWebExtStorage } from "@/composables/useWebExtStorage";
import { HEIGHT_CHECK_INTERVAL } from "../constants/intervals";

type ChainState = { height: number; minValuePerByte?: number };

const usePrivateState = defineStore("_chain", () => {
  const state = useWebExtStorage<ChainState>("ergoChainState", { height: 0 });
  return { state };
});

export const useChainStore = defineStore("chain", () => {
  const privateState = usePrivateState();
  let intervalId: ReturnType<typeof setInterval> | undefined;
  let fetchingHeight = false;

  onMounted(async () => {
    await Promise.all([fetchParams(), fetchHeight()]);
    intervalId = setInterval(fetchHeight, HEIGHT_CHECK_INTERVAL);
  });

  onUnmounted(() => {
    if (intervalId) clearInterval(intervalId);
  });

  const height = computed(() => privateState.state.height);
  const minValuePerByte = computed(() =>
    BigInt(privateState.state.minValuePerByte ?? BOX_VALUE_PER_BYTE)
  );

  async function fetchHeight() {
    if (fetchingHeight) return;
    fetchingHeight = true;

    const height = await graphQLService.getHeight();
    if (height && height !== privateState.state.height) {
      privateState.state.height = height;
    }

    fetchingHeight = false;
  }

  async function fetchParams() {
    const minValuePerByte = await graphQLService.getMinValuePerByte();
    if (minValuePerByte && minValuePerByte !== privateState.state.minValuePerByte) {
      privateState.state.minValuePerByte = minValuePerByte;
    }
  }

  return { height, minValuePerByte };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useChainStore, import.meta.hot));
  import.meta.hot.accept(acceptHMRUpdate(usePrivateState, import.meta.hot));
}
