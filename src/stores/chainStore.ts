import { computed, onMounted, onUnmounted, watch } from "vue";
import { BOX_VALUE_PER_BYTE } from "@fleet-sdk/core";
import { acceptHMRUpdate, defineStore } from "pinia";
import { getMinValuePerByte } from "@/chains/ergo/services/hergmesService";
import { useWebExtStorage } from "@/composables/useWebExtStorage";
import { useRelayStore } from "./relayStore";

type ChainState = { height: number; minValuePerByte?: number };

const usePrivateState = defineStore("_chain", () => {
  const state = useWebExtStorage<ChainState>("ergoChainState", { height: 0 });
  return { state };
});

export const useChainStore = defineStore("chain", () => {
  const privateState = usePrivateState();
  const relayStore = useRelayStore();
  let stopFollowing: (() => void) | undefined;

  // the relay's tip comes only over its socket, which opens on the first subscription, so the
  // height and parameters are read once over REST for pages that subscribe to nothing
  onMounted(() => {
    watch(
      () => relayStore.relay,
      (relay) => {
        stopFollowing?.();
        stopFollowing = relay?.onTip((tip) => {
          setHeight(tip.height);
          setMinValuePerByte(relay.parameters?.minValuePerByte);
        });

        fetchHeight();
        fetchParams();
      },
      { immediate: true }
    );
  });

  onUnmounted(() => stopFollowing?.());

  const height = computed(() => privateState.state.height);
  const minValuePerByte = computed(() =>
    BigInt(privateState.state.minValuePerByte ?? BOX_VALUE_PER_BYTE)
  );

  async function fetchHeight() {
    setHeight((await relayStore.readStatus())?.tip?.height);
  }

  async function fetchParams() {
    setMinValuePerByte(await getMinValuePerByte());
  }

  function setHeight(height: number | undefined) {
    if (height && height !== privateState.state.height) privateState.state.height = height;
  }

  function setMinValuePerByte(value: number | undefined) {
    if (value && value !== privateState.state.minValuePerByte) {
      privateState.state.minValuePerByte = value;
    }
  }

  return { height, minValuePerByte };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useChainStore, import.meta.hot));
  import.meta.hot.accept(acceptHMRUpdate(usePrivateState, import.meta.hot));
}
