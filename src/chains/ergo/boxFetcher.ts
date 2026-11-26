import { sortBy } from "es-toolkit";
import { getSpendableBoxes, type SpendableBox } from "@/chains/ergo/services/hergmesService";
import { ERG_TOKEN_ID } from "@/constants/ergo";
import { addressesDbService } from "@/database/addressesDbService";
import { assetsDbService } from "@/database/assetsDbService";
import { walletsDbService } from "@/database/walletsDbService";

/**
 * The wallet's spendable boxes with the mempool applied, newest first, in one read per address,
 * for the service worker, which can't follow them over the relay's socket (`useBoxesStore`).
 */
export async function fetchBoxes(walletId: number): Promise<SpendableBox[]> {
  const boxes = await readHoldersFirst(walletId, getSpendableBoxes, (b) => b.length === 0);
  return sortBy(boxes, [(x) => x.creationHeight]).reverse();
}

/**
 * Reads the addresses known to hold ERG, which every box carries, so they hold all the wallet's
 * assets. The local balance can lag behind the chain, so the other addresses are read when the
 * holders come back empty, and all of them when none is known. The default address is read with
 * the holders: change goes there, and dApps send to it, before a sync can mark it as a holder.
 */
export async function readHoldersFirst<T>(
  walletId: number,
  read: (addresses: string[]) => Promise<T>,
  isEmpty: (result: T) => boolean
): Promise<T> {
  const [addresses, holders, wallet] = await Promise.all([
    addressesDbService.getByWalletId(walletId),
    assetsDbService.getAddressesByTokenId(walletId, ERG_TOKEN_ID),
    walletsDbService.getById(walletId)
  ]);
  const all = addresses.map((a) => a.script);
  if (!holders.length) return read(all);

  const first = new Set(holders);
  const defaultIndex = wallet?.settings.defaultChangeIndex ?? 0;
  const defaultAddress = addresses.find((a) => a.index === defaultIndex);
  if (defaultAddress) first.add(defaultAddress.script);

  const result = await read([...first]);
  if (!isEmpty(result)) return result;

  return read(all.filter((a) => !first.has(a)));
}
