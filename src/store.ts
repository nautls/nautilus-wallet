import { createStore } from "vuex";
import { BigNumber } from "bignumber.js";
import { clone, groupBy, last, maxBy, sortBy, take } from "lodash-es";
import AES from "crypto-js/aes";
import { hex } from "@fleet-sdk/crypto";
import { first, isEmpty, uniq } from "@fleet-sdk/common";
import { utxosDbService } from "./database/utxosDbService";
import { MIN_UTXO_SPENT_CHECK_TIME } from "./constants/intervals";
import { useAppStore } from "./stores/appStore";
import { useAssetsStore } from "./stores/assetsStore";
import { graphQLService } from "@/chains/ergo/services/graphQlService";
import { AssetPriceRate, ergoDexService } from "@/chains/ergo/services/ergoDexService";
import { walletsDbService } from "@/database/walletsDbService";
import HdKey, { DerivedAddress } from "@/chains/ergo/hdKey";
import { coinGeckoService } from "@/chains/ergo/services/coinGeckoService";
import {
  AddressState,
  AddressType,
  AssetSubtype,
  Network,
  StateAddress,
  StateAsset,
  StateWallet,
  UpdateChangeIndexCommand,
  UpdateUsedAddressesFilterCommand,
  UpdateWalletSettingsCommand,
  WalletType
} from "@/types/internal";
import { hdKeyPool } from "@/common/objectPool";
import { ACTIONS, GETTERS, MUTATIONS } from "@/constants/store";
import { decimalize, toBigNumber } from "@/common/bigNumbers";
import { CHUNK_DERIVE_LENGTH, ERG_TOKEN_ID } from "@/constants/ergo";
import { IDbAddress, IDbAsset, IDbWallet } from "@/types/database";
import router from "@/router";
import { addressesDbService } from "@/database/addressesDbService";
import { assetsDbService } from "@/database/assetsDbService";

function goTo(routerName: string) {
  const { redirect, popup } = router.currentRoute.value.query;
  if (redirect !== "false" || popup !== "true") {
    router.push({ name: routerName });
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let app: ReturnType<typeof useAppStore>;
let assets: ReturnType<typeof useAssetsStore>;

export default createStore({
  state: {
    wallets: [] as StateWallet[],
    currentWallet: {
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
    } as StateWallet,
    currentAddresses: [] as StateAddress[],
    loading: {
      price: false,
      addresses: true,
      balance: true,
      wallets: true
    },
    ergPrice: 0,
    assetMarketRates: {
      [ERG_TOKEN_ID]: { erg: 1 }
    } as AssetPriceRate
  },
  getters: {
    [GETTERS.BALANCE](state) {
      const balance: StateAsset[] = [];

      const groups = groupBy(
        state.currentAddresses.filter((a) => a.balance).flatMap((a) => a.balance || []),
        (a) => a?.tokenId
      );

      for (const key in groups) {
        if (assets.blacklist.includes(key)) continue;

        const group = groups[key];
        if (group.length === 0) continue;

        const token: StateAsset = {
          tokenId: group[0].tokenId,
          confirmedAmount: group.map((a) => a.confirmedAmount).reduce((acc, val) => acc.plus(val)),
          unconfirmedAmount: group
            .map((a) => a.unconfirmedAmount)
            .reduce((acc, val) => acc?.plus(val || 0)),
          info: group[0].info
        };

        balance.push(token);
      }

      if (isEmpty(balance)) {
        return [
          {
            tokenId: ERG_TOKEN_ID,
            confirmedAmount: new BigNumber(0),
            info: assets.metadata.get(ERG_TOKEN_ID)
          }
        ];
      }

      return sortBy(balance, [(a) => a.tokenId !== ERG_TOKEN_ID, (a) => a.info?.name]);
    },
    [GETTERS.PICTURE_NFT_BALANCE](_, getters) {
      const balance: StateAsset[] = getters[GETTERS.BALANCE];
      return balance.filter((b) => b.info && b.info.type === AssetSubtype.PictureArtwork);
    },
    [GETTERS.NON_PICTURE_NFT_BALANCE](_, getters) {
      const balance: StateAsset[] = getters[GETTERS.BALANCE];
      return balance.filter((b) => !b.info || b.info.type !== AssetSubtype.PictureArtwork);
    },
    [GETTERS.NON_NFT_BALANCE](_, getters) {
      const balance: StateAsset[] = getters[GETTERS.BALANCE];
      return balance.filter(
        (b) =>
          !b.info ||
          !b.info.type ||
          (b.info.type !== AssetSubtype.AudioArtwork &&
            b.info.type !== AssetSubtype.VideoArtwork &&
            b.info.type !== AssetSubtype.PictureArtwork &&
            b.info.type !== AssetSubtype.ThresholdSignature)
      );
    }
  },
  mutations: {
    [MUTATIONS.SET_CURRENT_WALLET](state, identifier: StateWallet | number) {
      const selected =
        typeof identifier === "number" ? state.wallets.find((w) => w.id == identifier) : identifier;

      if (!selected || !selected.id) {
        throw Error("Wallet not found");
      }

      if (typeof identifier !== "number") {
        const i = state.wallets.findIndex((x) => x.id == selected.id);
        if (i > -1) {
          state.wallets[i] = selected;
        } else {
          state.wallets.push(selected);
        }
      }

      state.currentWallet = selected;
    },
    [MUTATIONS.SET_CURRENT_ADDRESSES](
      state,
      content: { addresses: StateAddress[]; walletId?: number }
    ) {
      // don't commit if the default wallet gets changed
      if (state.currentWallet.id !== content.walletId) {
        return;
      }

      if (state.currentAddresses.length !== 0) {
        for (const address of content.addresses) {
          const stateAddr = state.currentAddresses.find((a) => a.script === address.script);
          if (stateAddr && stateAddr.balance) {
            address.balance = stateAddr.balance;
          }
        }
      }

      state.currentAddresses = sortBy(content.addresses, (a) => a.index);
    },
    [MUTATIONS.ADD_ADDRESS](state, content: { address: StateAddress; walletId: number }) {
      if (state.currentWallet.id != content.walletId) {
        return;
      }

      state.currentAddresses.push(content.address);
    },
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
          address.balance = undefined;
          continue;
        }

        address.balance = group.map((x) => {
          return {
            tokenId: x.tokenId,
            confirmedAmount:
              decimalize(
                toBigNumber(x.confirmedAmount),
                assets.metadata.get(x.tokenId)?.decimals ?? 0
              ) || new BigNumber(0),
            unconfirmedAmount: decimalize(
              toBigNumber(x.unconfirmedAmount),
              assets.metadata.get(x.tokenId)?.decimals ?? 0
            ),
            info: assets.metadata.get(x.tokenId)
          };
        });
      }
    },
    [MUTATIONS.SET_ERG_PRICE](state, price) {
      state.ergPrice = price;
    },
    [MUTATIONS.SET_LOADING](state, obj) {
      state.loading = Object.assign(state.loading, obj);
    },
    [MUTATIONS.SET_WALLETS](state, wallets: IDbWallet[]) {
      state.wallets = wallets.map((w) => {
        return {
          id: w.id || 0,
          name: w.name,
          type: w.type,
          publicKey: w.publicKey,
          extendedPublicKey: hex.encode(hdKeyPool.get(w.publicKey).extendedPublicKey),
          balance: new BigNumber(0),
          settings: w.settings
        };
      });
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
    [MUTATIONS.SET_MARKET_RATES](state, rates: AssetPriceRate) {
      rates[ERG_TOKEN_ID] = { erg: 1 };
      state.assetMarketRates = rates;
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
    async [ACTIONS.INIT]({ state, dispatch }) {
      // workaround to keep everything working while refactoring and migrating to pinia
      // todo: remove this
      app = useAppStore();
      assets = useAssetsStore();
      await sleep(20); // wait for settings store to be initialized

      await dispatch(ACTIONS.LOAD_WALLETS);

      if (router.currentRoute.value.query.popup === "true") {
        return;
      }

      if (state.wallets.length > 0) {
        let current = state.wallets.find((w) => w.id === app.settings.lastOpenedWalletId);
        if (!current) {
          current = first(state.wallets);
        }

        dispatch(ACTIONS.SET_CURRENT_WALLET, current);
      } else {
        goTo("add-wallet");
      }
    },
    async [ACTIONS.LOAD_MARKET_RATES]({ commit }) {
      const tokenMarketRates = await ergoDexService.getTokenRates();
      commit(MUTATIONS.SET_MARKET_RATES, tokenMarketRates);
    },
    async [ACTIONS.LOAD_WALLETS]({ commit }) {
      const wallets = await walletsDbService.getAll();
      if (isEmpty(wallets)) return;

      for (const wallet of wallets) {
        const deriver = HdKey.fromPublicKey({
          publicKey: wallet.publicKey,
          chainCode: wallet.chainCode
        });

        hdKeyPool.alloc(deriver, wallet.publicKey);
      }

      commit(MUTATIONS.SET_WALLETS, wallets);
      commit(MUTATIONS.SET_LOADING, { wallets: false });
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

      hdKeyPool.alloc(key.neutered(), hex.encode(key.publicKey));
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
    async [ACTIONS.FETCH_AND_SET_AS_CURRENT_WALLET]({ dispatch }, id: number) {
      const wallet = await walletsDbService.getById(id);
      if (!wallet || !wallet.id) throw Error("wallet not found");

      const key = hdKeyPool.get(wallet.publicKey);
      const stateWallet: StateWallet = {
        id: wallet.id,
        name: wallet.name,
        type: wallet.type,
        publicKey: wallet.publicKey,
        extendedPublicKey: hex.encode(key.extendedPublicKey),
        settings: wallet.settings
      };

      await dispatch(ACTIONS.SET_CURRENT_WALLET, stateWallet);
    },
    async [ACTIONS.SET_CURRENT_WALLET]({ commit, dispatch }, wallet: StateWallet | number) {
      const walletId = typeof wallet === "number" ? wallet : wallet.id;
      commit(MUTATIONS.SET_LOADING, { balance: true, addresses: true });
      commit(MUTATIONS.SET_CURRENT_WALLET, wallet);
      commit(MUTATIONS.SET_CURRENT_ADDRESSES, { addresses: [], walletId });
      app.settings.lastOpenedWalletId = walletId;
      await dispatch(ACTIONS.REFRESH_CURRENT_ADDRESSES);
    },
    async [ACTIONS.NEW_ADDRESS]({ state, commit }) {
      const lastUsedIndex = state.currentAddresses.findLastIndex(
        (a) => a.state === AddressState.Used
      );

      if (state.currentAddresses.length - lastUsedIndex > CHUNK_DERIVE_LENGTH) {
        throw Error(
          `You cannot add more than ${CHUNK_DERIVE_LENGTH} consecutive unused addresses.`
        );
      }

      const walletId = state.currentWallet.id;
      const pk = state.currentWallet.publicKey;
      const index = (maxBy(state.currentAddresses, (a) => a.index)?.index || 0) + 1;
      const address = hdKeyPool.get(pk).deriveAddress(index);
      await addressesDbService.put({
        type: AddressType.P2PK,
        state: AddressState.Unused,
        script: address.script,
        index: address.index,
        walletId: walletId
      });

      commit(MUTATIONS.ADD_ADDRESS, {
        address: {
          script: address.script,
          state: AddressState.Unused,
          index: address.index,
          balance: undefined
        },
        walletId
      });
    },
    async [ACTIONS.REFRESH_CURRENT_ADDRESSES]({ state, commit, dispatch }) {
      if (!state.currentWallet.id) return;

      const walletId = state.currentWallet.id;
      const pk = state.currentWallet.publicKey;
      const key = hdKeyPool.get(pk);
      const dbAddresses = await addressesDbService.getByWalletId(walletId);
      let active = dbAddresses.map((a): StateAddress => ({ ...a, balance: undefined }));
      active = sortBy(active, (a) => a.index);

      let derived: DerivedAddress[] = [];
      let used: string[] = [];
      let usedChunk: string[] = [];
      let lastUsed: string | undefined;
      const lastStored = last(active)?.script;
      const maxIndex = maxBy(active, (a) => a.index)?.index;
      let offset = maxIndex !== undefined ? maxIndex + 1 : 0;

      if (active.length > 0) {
        if (state.currentAddresses.length === 0) {
          commit(MUTATIONS.SET_CURRENT_ADDRESSES, { addresses: clone(active), walletId });
          dispatch(ACTIONS.LOAD_BALANCES, walletId);
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
            balance: undefined
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
      commit(MUTATIONS.SET_CURRENT_ADDRESSES, { addresses: addr, walletId: walletId });

      if (lastUsed !== null) {
        dispatch(ACTIONS.FETCH_BALANCES, {
          addresses: active.map((a) => a.script),
          walletId
        });
      }

      commit(MUTATIONS.SET_LOADING, { addresses: false });
    },
    async [ACTIONS.LOAD_BALANCES]({ commit }, walletId: number) {
      const dbAssets = await assetsDbService.getByWalletId(walletId);

      await assets.loadMetadataFor(dbAssets.map((a) => a.tokenId));
      commit(MUTATIONS.UPDATE_BALANCES, { assets: dbAssets, walletId });
    },
    async [ACTIONS.REMOVE_WALLET]({ state, commit, dispatch }, walletId: number) {
      await walletsDbService.delete(walletId);

      if (state.currentWallet.id === walletId) {
        const wallet = state.wallets.find((w) => w.id !== walletId);
        if (wallet) {
          await dispatch(ACTIONS.SET_CURRENT_WALLET, wallet);
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
    async [ACTIONS.FETCH_CURRENT_PRICES]({ commit, dispatch, state }) {
      if (state.loading.price) {
        return;
      }

      commit(MUTATIONS.SET_LOADING, { price: true });

      const price = await coinGeckoService.getPrice(app.settings.conversionCurrency);
      commit(MUTATIONS.SET_ERG_PRICE, price);

      commit(MUTATIONS.SET_LOADING, { price: false });
      await dispatch(ACTIONS.LOAD_MARKET_RATES);
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
