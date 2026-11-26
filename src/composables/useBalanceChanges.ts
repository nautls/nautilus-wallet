import { onScopeDispose, shallowRef, watch } from "vue";
import { BigNumber } from "@/common/bigNumber";
import type { AssetBalance } from "@/stores/walletStore";

export type BalanceDirection = "up" | "down";

interface Move {
  /** Changes on every balance change of the token, to key its amount by. */
  rev: number;
  direction: BalanceDirection;
}

interface Snapshot {
  walletId: number;
  amounts: Map<string, { balance: BigNumber; decimals?: number }>;
}

const NEW_TOKEN_MS = 1500;

/**
 * Follows the balance of each token of the open wallet and reports the changes a person
 * should see happen: only those of the same wallet while `live`. Anything that changes
 * while not live (loading, amounts hidden) becomes the new baseline without being reported.
 */
export function useBalanceChanges(
  walletId: () => number,
  balances: () => AssetBalance[],
  live: () => boolean,
  onChange?: (deltas: Map<string, BigNumber>) => void
) {
  const moves = shallowRef(new Map<string, Move>());
  const newTokens = shallowRef(new Set<string>());
  let removedTokens = new Set<string>();
  let snapshot: Snapshot | undefined;
  let rev = 0;
  let newTokensTimer: ReturnType<typeof setTimeout> | undefined;

  function clearNewTokens() {
    clearTimeout(newTokensTimer);
    if (newTokens.value.size > 0) newTokens.value = new Set();
  }

  watch(
    [walletId, balances, live],
    ([id, current, isLive]) => {
      const previous = snapshot;
      snapshot = {
        walletId: id,
        amounts: new Map(
          current.map((a) => [a.tokenId, { balance: a.balance, decimals: a.metadata?.decimals }])
        )
      };

      removedTokens = new Set();
      if (previous?.walletId !== id) {
        moves.value = new Map();
        clearNewTokens();
      }
      if (!isLive || previous?.walletId !== id) return;

      const deltas = new Map<string, BigNumber>();
      const added = new Set<string>();
      const nextMoves = new Map(moves.value);
      for (const [tokenId, now] of snapshot.amounts) {
        const before = previous.amounts.get(tokenId);
        if (!before) {
          added.add(tokenId);
          deltas.set(tokenId, now.balance);
          continue;
        }

        // amounts are decimalized with the token's metadata, which can arrive after them
        if (before.decimals !== now.decimals) continue;

        const delta = now.balance.minus(before.balance);
        if (delta.isZero()) continue;
        deltas.set(tokenId, delta);
        nextMoves.set(tokenId, { rev: ++rev, direction: delta.isPositive() ? "up" : "down" });
      }

      for (const tokenId of previous.amounts.keys()) {
        if (snapshot.amounts.has(tokenId)) continue;
        removedTokens.add(tokenId);
        deltas.set(tokenId, previous.amounts.get(tokenId)!.balance.negated());
      }

      if (deltas.size === 0) return;
      moves.value = nextMoves;
      if (added.size > 0) {
        clearTimeout(newTokensTimer);
        newTokens.value = new Set([...newTokens.value, ...added]);
        newTokensTimer = setTimeout(clearNewTokens, NEW_TOKEN_MS);
      }

      onChange?.(deltas);
    },
    { immediate: true }
  );

  onScopeDispose(() => clearTimeout(newTokensTimer));

  return {
    /** Key for a token's amount that changes whenever its balance does. */
    amountKey: (tokenId: string) => `${tokenId}:${moves.value.get(tokenId)?.rev ?? 0}`,
    direction: (tokenId: string) => moves.value.get(tokenId)?.direction,
    isNew: (tokenId: string) => newTokens.value.has(tokenId),
    /** Whether the token is gone because its balance dropped to zero in the last change. */
    isRemoved: (tokenId: string) => removedTokens.has(tokenId)
  };
}
