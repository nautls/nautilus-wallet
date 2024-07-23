import { createStore } from "vuex";
import { clone, groupBy, last, maxBy, sortBy, take } from "lodash-es";
import AES from "crypto-js/aes";
import { hex } from "@fleet-sdk/crypto";
import { isEmpty, uniq } from "@fleet-sdk/common";
import { utxosDbService } from "./database/utxosDbService";
import { MIN_UTXO_SPENT_CHECK_TIME } from "./constants/intervals";
import { useAppStore } from "./stores/appStore";
import { useAssetsStore } from "./stores/assetsStore";
import { useWalletStore } from "./stores/walletStore";
import { graphQLService } from "@/chains/ergo/services/graphQlService";
import { walletsDbService } from "@/database/walletsDbService";
import HdKey, { IndexedAddress } from "@/chains/ergo/hdKey";
import {
  AddressState,
  AddressType,
  Network,
  StateAddress,
  UpdateChangeIndexCommand,
  UpdateUsedAddressesFilterCommand,
  UpdateWalletSettingsCommand,
  WalletType
} from "@/types/internal";
import { hdKeyPool } from "@/common/objectPool";
import { ACTIONS, MUTATIONS } from "@/constants/store";
import { bn, decimalize } from "@/common/bigNumber";
import { CHUNK_DERIVE_LENGTH } from "@/constants/ergo";
import { IDbAddress, IDbAsset } from "@/types/database";
import router from "@/router";
import { addressesDbService } from "@/database/addressesDbService";
import { assetsDbService } from "@/database/assetsDbService";

function goTo(routerName: string) {
  const { redirect, popup } = router.currentRoute.value.query;
  if (redirect !== "false" || popup !== "true") router.push({ name: routerName });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let app: ReturnType<typeof useAppStore>;
let assets: ReturnType<typeof useAssetsStore>;
let wallet: ReturnType<typeof useWalletStore>;

export default createStore({
  state: {
    loading: {
      addresses: true,
      balance: true,
      wallets: true
    }
  },
  mutations: {
    [MUTATIONS.UPDATE_BALANCES](state, data: { assets: IDbAsset[]; walletId: number }) {
      if (
        !data.assets ||
        data.assets.length === 0 ||
        state.currentAddresses.length === 0 ||
        state.currentWallet.id !== data.walletId
      ) {
        return;
      }

      const groups = groupBy(data.assets, (a) => a.address);
      for (const address of state.currentAddresses) {
        const group = groups[address.script];
        if (!group || group.length === 0) {
          address.assets = [];
          continue;
        }

        address.assets = group.map((x) => {
          const metadata = assets.metadata.get(x.tokenId);
          return {
            tokenId: x.tokenId,
            confirmedAmount: decimalize(bn(x.confirmedAmount) || bn(0), metadata?.decimals),
            unconfirmedAmount: decimalize(bn(x.unconfirmedAmount), metadata?.decimals),
            metadata
          };
        });
      }
    },
    [MUTATIONS.SET_LOADING](state, obj) {
      state.loading = Object.assign(state.loading, obj);
    },
    [MUTATIONS.SET_WALLET_SETTINGS](state, command: UpdateWalletSettingsCommand) {
      const wallet = state.wallets.find((w) => w.id === command.walletId);
      if (!wallet) return;

      wallet.name = command.name;
      wallet.settings.avoidAddressReuse = command.avoidAddressReuse;
      wallet.settings.hideUsedAddresses = command.hideUsedAddresses;
    },
    [MUTATIONS.SET_DEFAULT_CHANGE_INDEX](state, command: UpdateChangeIndexCommand) {
      const wallet = state.wallets.find((w) => w.id === command.walletId);
      if (!wallet) return;

      wallet.settings.defaultChangeIndex = command.index;
    },
    [MUTATIONS.SET_USED_ADDRESSES_FILTER](state, command: UpdateUsedAddressesFilterCommand) {
      const wallet = state.wallets.find((w) => w.id === command.walletId);
      if (!wallet) return;

      wallet.settings.hideUsedAddresses = command.filter;
    },
    [MUTATIONS.REMOVE_WALLET](state, walletId: number) {
      if (state.currentWallet.id === walletId) {
        state.currentWallet = state.wallets.find((w) => w.id !== walletId) ?? {
          id: 0,
          name: "",
          type: WalletType.Standard,
          publicKey: "",
          extendedPublicKey: "",
          settings: {
            avoidAddressReuse: false,
            hideUsedAddresses: false,
            defaultChangeIndex: 0
          }
        };

        state.currentAddresses = [];
      }

      const removeIndex = state.wallets.findIndex((w) => w.id === walletId);
      if (removeIndex > -1) {
        state.wallets.splice(removeIndex, 1);
      }
    }
  },
  actions: {
    async [ACTIONS.INIT]() {
      // workaround to keep everything working while refactoring and migrating to pinia
      // todo: remove this
      app = useAppStore();
      assets = useAssetsStore();
      wallet = useWalletStore();
      await sleep(20); // wait for stores to be initialized

      if (router.currentRoute.value.query.popup === "true") return;
      if (!app.settings.lastOpenedWalletId) {
        goTo("add-wallet");
      }
    },
    async [ACTIONS.PUT_WALLET](
      { dispatch },
      wallet:
        | { extendedPublicKey: string; name: string; type: WalletType.ReadOnly | WalletType.Ledger }
        | { mnemonic: string; password: string; name: string; type: WalletType.Standard }
    ) {
      const key =
        wallet.type === WalletType.Standard
          ? await HdKey.fromMnemonic(wallet.mnemonic)
          : HdKey.fromPublicKey(wallet.extendedPublicKey);

      hdKeyPool.alloc(hex.encode(key.publicKey), key.neutered());
      const walletId = await walletsDbService.put({
        name: wallet.name.trim(),
        network: Network.ErgoMainnet,
        type: wallet.type,
        publicKey: hex.encode(key.publicKey),
        chainCode: hex.encode(key.chainCode),
        mnemonic:
          wallet.type === WalletType.Standard
            ? AES.encrypt(wallet.mnemonic, wallet.password).toString()
            : undefined,
        settings: {
          avoidAddressReuse: false,
          hideUsedAddresses: false,
          defaultChangeIndex: 0
        }
      });

      await dispatch(ACTIONS.FETCH_AND_SET_AS_CURRENT_WALLET, walletId);
    },
    async [ACTIONS.FETCH_AND_SET_AS_CURRENT_WALLET](_, id: number) {
      wallet.load(id);
    },
    async [ACTIONS.REFRESH_CURRENT_ADDRESSES]({ state, commit, dispatch }) {
      if (!state.currentWallet.id) return;

      const walletId = state.currentWallet.id;
      const pk = state.currentWallet.publicKey;
      const key = hdKeyPool.get(pk);
      const dbAddresses = await addressesDbService.getByWalletId(walletId);
      let active = dbAddresses.map((a): StateAddress => ({ ...a, assets: [] }));
      active = sortBy(active, (a) => a.index);

      let derived: IndexedAddress[] = [];
      let used: string[] = [];
      let usedChunk: string[] = [];
      let lastUsed: string | undefined;
      const lastStored = last(active)?.script;
      const maxIndex = maxBy(active, (a) => a.index)?.index;
      let offset = maxIndex !== undefined ? maxIndex + 1 : 0;

      if (active.length > 0) {
        if (state.currentAddresses.length === 0) {
          commit(MUTATIONS.SET_CURRENT_ADDRESSES, { addresses: clone(active), walletId });
        }

        used = used.concat(await graphQLService.getUsedAddresses(active.map((a) => a.script)));
        lastUsed = last(used);
      }

      do {
        derived = key.deriveAddresses(CHUNK_DERIVE_LENGTH, offset);
        offset += derived.length;
        usedChunk = await graphQLService.getUsedAddresses(derived.map((a) => a.script));
        used = used.concat(usedChunk);
        active = active.concat(
          derived.map((d) => ({
            index: d.index,
            script: d.script,
            state: AddressState.Unused,
            balance: []
          }))
        );
        if (usedChunk.length > 0) {
          lastUsed = last(usedChunk);
        }
      } while (usedChunk.length > 0);

      const lastUsedIndex = active.findIndex((a) => a.script === lastUsed);
      const lastStoredIndex = active.findIndex((a) => a.script === lastStored);
      if (lastStoredIndex > lastUsedIndex) {
        active = take(active, lastStoredIndex + 1);
      } else if (lastUsedIndex > -1) {
        active = take(active, lastUsedIndex + 2);
      } else {
        active = take(active, 1);
      }

      for (const addr of active) {
        if (used.find((address) => addr.script === address)) {
          addr.state = AddressState.Used;
        }
      }

      await addressesDbService.bulkPut(
        active.map((a) => {
          return {
            type: AddressType.P2PK,
            state: a.state,
            script: a.script,
            index: a.index,
            walletId: walletId
          };
        }),
        walletId
      );

      const addr = (await addressesDbService.getByWalletId(walletId)).map((a: IDbAddress) => {
        return {
          script: a.script,
          state: a.state,
          index: a.index,
          balance: undefined
        };
      });
      // commit(MUTATIONS.SET_CURRENT_ADDRESSES, { addresses: addr, walletId: walletId });

      if (lastUsed !== null) {
        dispatch(ACTIONS.FETCH_BALANCES, {
          addresses: active.map((a) => a.script),
          walletId
        });
      }

      commit(MUTATIONS.SET_LOADING, { addresses: false });
    },
    async [ACTIONS.REMOVE_WALLET]({ state, commit }, walletId: number) {
      await walletsDbService.delete(walletId);

      if (state.currentWallet.id === walletId) {
        const wallet = state.wallets.find((w) => w.id !== walletId);
        if (wallet) {
          // await dispatch(ACTIONS.SET_CURRENT_WALLET, wallet);
          router.push({ name: "assets-page" });
        } else {
          router.push({ name: "add-wallet" });
        }
      }

      commit(MUTATIONS.REMOVE_WALLET, walletId);
    },
    async [ACTIONS.FETCH_BALANCES](
      { commit, dispatch },
      data: { addresses: string[]; walletId: number }
    ) {
      const balance = await graphQLService.getAddressesBalance(data.addresses);
      assetsDbService.sync(
        balance.map((entry): IDbAsset => ({ ...entry, walletId: data.walletId })),
        data.walletId
      );

      await assets.loadMetadataFor(balance.map((x) => x.tokenId));
      commit(MUTATIONS.UPDATE_BALANCES, { balance, walletId: data.walletId });
      commit(MUTATIONS.SET_LOADING, { balance: false });
      dispatch(ACTIONS.CHECK_PENDING_BOXES);
    },
    async [ACTIONS.CHECK_PENDING_BOXES]() {
      const now = Date.now();
      const boxes = (await utxosDbService.getAllPending()).filter(
        (b) => b.spentTimestamp && now - b.spentTimestamp >= MIN_UTXO_SPENT_CHECK_TIME
      );

      if (isEmpty(boxes)) return;

      const txIds = uniq(boxes.map((b) => b.spentTxId));
      const mempoolResult = await graphQLService.areTransactionsInMempool(txIds);
      await utxosDbService.removeByTxId(txIds.filter((id) => mempoolResult[id] === false));
    },
    async [ACTIONS.UPDATE_WALLET_SETTINGS]({ commit }, command: UpdateWalletSettingsCommand) {
      await walletsDbService.updateSettings(command.walletId, command.name, command);
      commit(MUTATIONS.SET_WALLET_SETTINGS, command);
    },
    async [ACTIONS.UPDATE_CHANGE_ADDRESS_INDEX]({ commit }, command: UpdateChangeIndexCommand) {
      await walletsDbService.updateChangeIndex(command.walletId, command.index);
      commit(MUTATIONS.SET_DEFAULT_CHANGE_INDEX, command);
    },
    async [ACTIONS.UPDATE_USED_ADDRESSES_FILTER](
      { commit },
      command: UpdateUsedAddressesFilterCommand
    ) {
      await walletsDbService.updateUsedAddressFilter(command.walletId, command.filter);
      commit(MUTATIONS.SET_USED_ADDRESSES_FILTER, command);
    }
  }
});
