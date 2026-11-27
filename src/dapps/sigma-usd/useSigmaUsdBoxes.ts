import { computed, type Ref, shallowRef, watch } from "vue";
import { type AgeUSDBankBox, type OracleBox, SIGMA_USD_PARAMETERS } from "@fleet-sdk/ageusd-plugin";
import type { Box } from "@fleet-sdk/common";
import type { BoxView } from "@hergmes/sdk";
import { useRelayStore } from "@/stores/relayStore";

const BANK_NFT = SIGMA_USD_PARAMETERS.tokens.nftId;
const ORACLE_NFT = SIGMA_USD_PARAMETERS.oracle.nftId;

type Pick = (view: BoxView) => Box | undefined;

/**
 * Follows the bank and oracle boxes, with the mempool applied, while the calling component is
 * mounted. A tx chains on a pending bank box, and reads a pending oracle box as a data input,
 * which the node accepts: the tx then fails only if that oracle update does, not whenever the
 * update confirms first.
 */
export function useSigmaUsdBoxes(): {
  bankBox: Ref<AgeUSDBankBox | undefined>;
  oracleBox: Ref<OracleBox | undefined>;
  loading: Ref<boolean>;
} {
  const relayStore = useRelayStore();
  const bankBox = shallowRef<AgeUSDBankBox>();
  const oracleBox = shallowRef<OracleBox>();
  /** Whether each key's first read is over, whatever its outcome; reconnects don't reset it. */
  const settled = shallowRef<boolean[]>([]);

  watch(
    () => relayStore.relay,
    (relay, _, onCleanup) => {
      settled.value = [];
      bankBox.value = undefined;
      oracleBox.value = undefined;
      if (!relay) return;

      settled.value = [false, false];
      const follow = <T extends Box>(
        i: number,
        tokenId: string,
        target: Ref<T | undefined>,
        pick: Pick
      ) => {
        const subscription = relay.subscribe({ tokenId });
        subscription.subscribe(({ phase, boxes }) => {
          if (!settled.value[i] && phase !== "snapshot" && phase !== "catching_up") {
            const next = [...settled.value];
            next[i] = true;
            settled.value = next;
          }
          const box = phase === "live" && boxes ? pick(boxes) : undefined;
          // a block can briefly come before the overlay that goes with it, leaving none; and each
          // message makes new box objects, so only another box replaces the current one
          if (box && box.boxId !== target.value?.boxId) target.value = box as T;
        });

        return subscription;
      };

      // Each NFT is in one box, so `spendable` holds one but for a moment after a block that
      // confirmed another update than the pending one: confirmed boxes come first, and the pending
      // one's parent is then gone.
      const holds = [
        follow(0, BANK_NFT, bankBox, (v) => v.spendable.find(isBankBox)),
        follow(1, ORACLE_NFT, oracleBox, (v) => v.spendable[0])
      ];
      onCleanup(() => holds.forEach((hold) => hold.close()));
    },
    { immediate: true }
  );

  const loading = computed(() => settled.value.includes(false));

  return { bankBox, oracleBox, loading };
}

function isBankBox(box: Box): boolean {
  return box.ergoTree === SIGMA_USD_PARAMETERS.contract;
}
