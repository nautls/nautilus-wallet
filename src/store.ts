import { createStore } from "vuex";
import { BigNumber } from "bignumber.js";
import {
  clone,
  difference,
  find,
  findIndex,
  findLastIndex,
  first,
  groupBy,
  isEmpty,
  last,
  maxBy,
  sortBy,
  take,
  union,
  uniq
} from "lodash-es";
import AES from "crypto-js/aes";
import { hex } from "@fleet-sdk/crypto";
import { some } from "@fleet-sdk/common";
import { connectedDAppsDbService } from "./database/connectedDAppsDbService";
import { utxosDbService } from "./database/utxosDbService";
import { MIN_UTXO_SPENT_CHECK_TIME, UPDATE_TOKENS_BLACKLIST_INTERVAL } from "./constants/intervals";
import { assetInfoDbService } from "./database/assetInfoDbService";
import { Token } from "./types/connector";
import { Prover } from "./chains/ergo/transaction/prover";
import { DEFAULT_EXPLORER_URL } from "./constants/explorer";
import { sendBackendServerUrl } from "./rpc/uiRpcHandlers";
import { getChangeAddress } from "@/chains/ergo/addresses";
import { extractAddressesFromInputs } from "@/chains/ergo/extraction";
import { getDefaultServerUrl, graphQLService } from "@/chains/ergo/services/graphQlService";
import { AssetPriceRate, ergoDexService } from "@/chains/ergo/services/ergoDexService";
import { walletsDbService } from "@/database/walletsDbService";
import HdKey, { DerivedAddress } from "@/chains/ergo/hdKey";
import { coinGeckoService } from "@/chains/ergo/services/coinGeckoService";
import {
  AddressState,
  AddressType,
  AssetSubtype,
  AssetType,
  Network,
  SignTxCommand,
  StateAddress,
  StateAsset,
  StateAssetInfo,
  StateWallet,
  UpdateChangeIndexCommand,
  UpdateUsedAddressesFilterCommand,
  UpdateWalletSettingsCommand,
  WalletType
} from "@/types/internal";
import { hdKeyPool } from "@/common/objectPool";
import { ACTIONS, GETTERS, MUTATIONS } from "@/constants/store";
import { decimalize, toBigNumber } from "@/common/bigNumbers";
import {
  CHUNK_DERIVE_LENGTH,
  ERG_DECIMALS,
  ERG_TOKEN_ID,
  MAINNET,
  UNKNOWN_MINTING_BOX_ID
} from "@/constants/ergo";
import { IAssetInfo, IDbAddress, IDbAsset, IDbDAppConnection, IDbWallet } from "@/types/database";
import router from "@/router";
import { addressesDbService } from "@/database/addressesDbService";
import { assetsDbService } from "@/database/assetsDbService";
import {
  ErgoTokenBlacklist,
  ergoTokenBlacklistService
} from "@/chains/ergo/services/tokenBlacklistService";
import { log } from "@/common/logger";

type TokenBlacklist = {
  lastUpdated: number;
} & ErgoTokenBlacklist;

function dbAddressMapper(a: IDbAddress) {
  return {
    script: a.script,
    state: a.state,
    index: a.index,
    balance: undefined
  };
}

function navigate(routerName: string) {
  if (router.currentRoute.value.query.redirect !== "false") {
    router.push({ name: routerName });
  }
}

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
    settings: {
      lastOpenedWalletId: 0,
      isKyaAccepted: false,
      conversionCurrency: "usd",
      devMode: !MAINNET,
      graphQLServer: getDefaultServerUrl(),
      explorerUrl: DEFAULT_EXPLORER_URL,
      hideBalances: false,
      blacklistedTokensLists: ["nsfw", "scam"]
    },
    loading: {
      settings: true,
      price: false,
      addresses: true,
      balance: true,
      wallets: true
    },
    connections: Object.freeze([] as IDbDAppConnection[]),
    assetInfo: { [ERG_TOKEN_ID]: { name: "ERG", decimals: ERG_DECIMALS } } as StateAssetInfo,
    ergPrice: 0,
    tokensBlacklist: { ergo: { lastUpdated: Date.now(), tokenIds: [] as string[] } },
    assetMarketRates: {
      [ERG_TOKEN_ID]: { erg: 1 }
    } as AssetPriceRate
  },
  getters: {
    [GETTERS.BALANCE](state) {
      const balance: StateAsset[] = [];

      const groups = groupBy(
        state.currentAddresses
          .filter((a) => a.balance)
          .map((a) => a.balance || [])
          .flat(),
        (a) => a?.tokenId
      );

      for (const key in groups) {
        if (state.tokensBlacklist.ergo.tokenIds.includes(key)) continue;

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
        balance.push({
          tokenId: ERG_TOKEN_ID,
          confirmedAmount: new BigNumber(0),
          info: state.assetInfo[ERG_TOKEN_ID]
        });

        return balance;
      }

      return sortBy(balance, [(a) => a.tokenId !== ERG_TOKEN_ID, (a) => a.info?.name]);
    },
    [GETTERS.PICTURE_NFT_BALANCE](state, getters) {
      const balance: StateAsset[] = getters[GETTERS.BALANCE];
      return balance.filter((b) => b.info && b.info.type === AssetSubtype.PictureArtwork);
    },
    [GETTERS.NON_PICTURE_NFT_BALANCE](state, getters) {
      const balance: StateAsset[] = getters[GETTERS.BALANCE];
      return balance.filter((b) => !b.info || b.info.type !== AssetSubtype.PictureArtwork);
    },
    [GETTERS.NON_NFT_BALANCE](state, getters) {
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
        typeof identifier === "number"
          ? find(state.wallets, (w) => w.id == identifier)
          : identifier;

      if (!selected || !selected.id) {
        throw Error("Wallet not found");
      }

      if (typeof identifier !== "number") {
        const i = findIndex(state.wallets, (x) => x.id == selected.id);
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
          const stateAddr = find(state.currentAddresses, (a) => a.script === address.script);
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
                state.assetInfo[x.tokenId]?.decimals ?? 0
              ) || new BigNumber(0),
            unconfirmedAmount: decimalize(
              toBigNumber(x.unconfirmedAmount),
              state.assetInfo[x.tokenId]?.decimals ?? 0
            ),
            info: state.assetInfo[x.tokenId]
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
    [MUTATIONS.SET_SETTINGS](state, settings) {
      state.settings = Object.assign(state.settings, settings);
    },
    [MUTATIONS.SET_CONNECTIONS](state, connections) {
      state.connections = Object.freeze(connections);
    },
    [MUTATIONS.SET_TOKENS_BLACKLIST](state, blacklist: TokenBlacklist) {
      if (isEmpty(state.settings.blacklistedTokensLists)) {
        state.tokensBlacklist = { ergo: { lastUpdated: blacklist.lastUpdated, tokenIds: [] } };
        return;
      }

      let tokenIds = [] as string[];
      for (const listName of state.settings.blacklistedTokensLists) {
        const list = blacklist[listName as keyof ErgoTokenBlacklist];
        if (some(list)) tokenIds = tokenIds.concat(list);
      }

      // remove duplicated tokens
      tokenIds = uniq(tokenIds);
      state.tokensBlacklist = { ergo: { lastUpdated: blacklist.lastUpdated, tokenIds } };
    },
    [MUTATIONS.SET_WALLET_SETTINGS](state, command: UpdateWalletSettingsCommand) {
      const wallet = find(state.wallets, (w) => w.id === command.walletId);
      if (!wallet) {
        return;
      }

      wallet.name = command.name;
      wallet.settings.avoidAddressReuse = command.avoidAddressReuse;
      wallet.settings.hideUsedAddresses = command.hideUsedAddresses;
    },
    [MUTATIONS.SET_DEFAULT_CHANGE_INDEX](state, command: UpdateChangeIndexCommand) {
      const wallet = find(state.wallets, (w) => w.id === command.walletId);
      if (!wallet) {
        return;
      }

      wallet.settings.defaultChangeIndex = command.index;
    },
    [MUTATIONS.SET_USED_ADDRESSES_FILTER](state, command: UpdateUsedAddressesFilterCommand) {
      const wallet = find(state.wallets, (w) => w.id === command.walletId);
      if (!wallet) {
        return;
      }

      wallet.settings.hideUsedAddresses = command.filter;
    },
    [MUTATIONS.SET_MARKET_RATES](state, rates: AssetPriceRate) {
      rates[ERG_TOKEN_ID] = { erg: 1 };
      state.assetMarketRates = rates;
    },
    [MUTATIONS.SET_ASSETS_INFO](state, assetsInfo: IAssetInfo[]) {
      if (isEmpty(assetsInfo)) {
        return;
      }

      for (const info of assetsInfo) {
        state.assetInfo[info.id] = {
          name: info.name,
          decimals: info.decimals,
          type: info.subtype,
          artworkUrl: info.artworkCover ?? info.artworkUrl
        };
      }
    },
    [MUTATIONS.REMOVE_WALLET](state, walletId: number) {
      if (state.currentWallet.id === walletId) {
        state.currentWallet = find(state.wallets, (w) => w.id !== walletId) ?? {
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

      const removeIndex = findIndex(state.wallets, (w) => w.id === walletId);
      if (removeIndex > -1) {
        state.wallets.splice(removeIndex, 1);
      }
    }
  },
  actions: {
    async [ACTIONS.INIT]({ state, dispatch }) {
      dispatch(ACTIONS.FETCH_FULL_ASSETS_INFO);
      await dispatch(ACTIONS.LOAD_SETTINGS);
      dispatch(ACTIONS.LOAD_TOKEN_BLACKLIST);
      await dispatch(ACTIONS.LOAD_WALLETS);

      if (router.currentRoute.value.query.popup === "true") {
        return;
      }

      if (state.wallets.length > 0) {
        let current = find(state.wallets, (w) => w.id === state.settings.lastOpenedWalletId);
        if (!current) {
          current = first(state.wallets);
        }

        dispatch(ACTIONS.SET_CURRENT_WALLET, current);
        dispatch(ACTIONS.LOAD_CONNECTIONS);
        navigate("assets-page");
      } else {
        navigate("add-wallet");
      }
    },
    async [ACTIONS.LOAD_MARKET_RATES]({ commit }) {
      const tokenMarketRates = await ergoDexService.getTokenRates();
      commit(MUTATIONS.SET_MARKET_RATES, tokenMarketRates);
    },
    [ACTIONS.LOAD_SETTINGS]({ commit }) {
      const rawSettings = localStorage.getItem("settings");
      if (rawSettings) {
        const parsed = JSON.parse(rawSettings);
        if (!parsed.graphQLServer) {
          parsed.graphQLServer = getDefaultServerUrl();
        }
        if (!parsed.explorerUrl) {
          parsed.explorerUrl = DEFAULT_EXPLORER_URL;
        }

        commit(MUTATIONS.SET_SETTINGS, parsed);
      }
      commit(MUTATIONS.SET_LOADING, { settings: false });
    },
    [ACTIONS.SAVE_SETTINGS]({ state, commit }, newSettings) {
      let graphQlChanged = false;
      if (newSettings) {
        graphQlChanged = newSettings.graphQLServer !== state.settings.graphQLServer;
        commit(MUTATIONS.SET_SETTINGS, newSettings);
      }

      localStorage.setItem("settings", JSON.stringify(state.settings));

      if (graphQlChanged) {
        graphQLService.updateServerUrl(state.settings.graphQLServer);
        sendBackendServerUrl(state.settings.graphQLServer);
      }
    },
    async [ACTIONS.LOAD_WALLETS]({ commit }) {
      const wallets = await walletsDbService.getAll();
      if (isEmpty(wallets)) {
        return;
      }

      for (const wallet of wallets) {
        hdKeyPool.alloc(
          HdKey.fromPublicKey({ publicKey: wallet.publicKey, chainCode: wallet.chainCode }),
          wallet.publicKey
        );
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
      if (!wallet || !wallet.id) {
        throw Error("wallet not found");
      }

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
      dispatch(ACTIONS.SAVE_SETTINGS, { lastOpenedWalletId: walletId });
      await dispatch(ACTIONS.REFRESH_CURRENT_ADDRESSES);
    },
    async [ACTIONS.NEW_ADDRESS]({ state, commit }) {
      const lastUsedIndex = findLastIndex(
        state.currentAddresses,
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
      if (!state.currentWallet.id) {
        return;
      }

      const walletId = state.currentWallet.id;
      const pk = state.currentWallet.publicKey;
      const key = hdKeyPool.get(pk);
      let active: StateAddress[] = sortBy(
        (await addressesDbService.getByWalletId(walletId)).map((a) => dbAddressMapper(a)),
        (a) => a.index
      );
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

      const lastUsedIndex = findIndex(active, (a) => a.script === lastUsed);
      const lastStoredIndex = findIndex(active, (a) => a.script === lastStored);
      if (lastStoredIndex > lastUsedIndex) {
        active = take(active, lastStoredIndex + 1);
      } else if (lastUsedIndex > -1) {
        active = take(active, lastUsedIndex + 2);
      } else {
        active = take(active, 1);
      }

      for (const addr of active) {
        if (find(used, (address) => addr.script === address)) {
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
    async [ACTIONS.LOAD_BALANCES]({ commit, dispatch }, walletId: number) {
      const assets = await assetsDbService.getByWalletId(walletId);

      await dispatch(
        ACTIONS.LOAD_ASSETS_INFO,
        assets.map((x) => x.tokenId)
      );
      commit(MUTATIONS.UPDATE_BALANCES, { assets, walletId });
    },
    async [ACTIONS.LOAD_ASSETS_INFO](
      { state, commit, dispatch },
      params: string[] | { assetInfo: Token[] }
    ) {
      const tokenIds = uniq(
        Array.isArray(params) ? params : params.assetInfo.map((x) => x.tokenId)
      );
      const unloaded = difference(tokenIds, Object.keys(state.assetInfo));

      if (!isEmpty(unloaded) && !Array.isArray(params)) {
        await assetInfoDbService.addIfNotExists(
          params.assetInfo
            .filter((x) => unloaded.includes(x.tokenId))
            .map((x) => {
              return {
                id: x.tokenId,
                mintingBoxId: UNKNOWN_MINTING_BOX_ID,
                name: x.name,
                decimals: x.decimals,
                type: AssetType.Unknown
              };
            })
        );
      }

      const assetsInfo = await assetInfoDbService.getAnyOf(unloaded);

      commit(MUTATIONS.SET_ASSETS_INFO, assetsInfo);
      dispatch(
        ACTIONS.FETCH_FULL_ASSETS_INFO,
        difference(
          unloaded,
          assetsInfo.map((x) => x.id)
        )
      );
    },
    async [ACTIONS.FETCH_FULL_ASSETS_INFO]({ commit }, assetIds: string[]) {
      const incompleteIds = union(assetIds, await assetInfoDbService.getIncompleteInfoIds());
      if (isEmpty(incompleteIds)) {
        return;
      }

      const info = await graphQLService.getAssetsInfo(incompleteIds);
      if (isEmpty(info)) {
        return;
      }

      await assetInfoDbService.bulkPut(info);
      commit(MUTATIONS.SET_ASSETS_INFO, info);
    },
    async [ACTIONS.REMOVE_WALLET]({ state, commit, dispatch }, walletId: number) {
      await walletsDbService.delete(walletId);

      if (state.currentWallet.id === walletId) {
        const wallet = find(state.wallets, (w) => w.id !== walletId);
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
      const balances = await graphQLService.getAddressesBalance(data.addresses);
      const assets = balances.map((x) => {
        return {
          tokenId: x.tokenId,
          confirmedAmount: x.confirmedAmount,
          unconfirmedAmount: x.unconfirmedAmount,
          address: x.address,
          walletId: data.walletId
        } as IDbAsset;
      });
      assetsDbService.sync(assets, data.walletId);

      await dispatch(ACTIONS.LOAD_ASSETS_INFO, {
        assetInfo: balances.map((x) => {
          return { tokenId: x.tokenId, name: x.name, decimals: x.decimals } as Token;
        })
      });
      commit(MUTATIONS.UPDATE_BALANCES, { assets, walletId: data.walletId });
      commit(MUTATIONS.SET_LOADING, { balance: false });
      dispatch(ACTIONS.CHECK_PENDING_BOXES);
    },
    async [ACTIONS.LOAD_TOKEN_BLACKLIST]({ commit }) {
      const dbKey = "ergoTokensBlacklist";
      const rawDbBlacklist = localStorage.getItem(dbKey);
      const blacklist: TokenBlacklist = rawDbBlacklist ? JSON.parse(rawDbBlacklist) : undefined;

      if (
        !blacklist?.lastUpdated ||
        Date.now() - blacklist.lastUpdated > UPDATE_TOKENS_BLACKLIST_INTERVAL
      ) {
        try {
          const ergoBlacklist = await ergoTokenBlacklistService.fetch();
          const newBlackList = { lastUpdated: Date.now(), ...ergoBlacklist };
          localStorage.setItem(dbKey, JSON.stringify(newBlackList));

          commit(MUTATIONS.SET_TOKENS_BLACKLIST, newBlackList);
        } catch (e) {
          log.error("Failed to fetch token blacklist", e);
        }
      } else if (blacklist) {
        commit(MUTATIONS.SET_TOKENS_BLACKLIST, blacklist);
      }
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

      const price = await coinGeckoService.getPrice(state.settings.conversionCurrency);
      commit(MUTATIONS.SET_ERG_PRICE, price);

      commit(MUTATIONS.SET_LOADING, { price: false });
      await dispatch(ACTIONS.LOAD_MARKET_RATES);
    },
    async [ACTIONS.SIGN_TX]({ state }, command: SignTxCommand) {
      const inputAddresses = extractAddressesFromInputs(command.tx.inputs);
      const ownAddresses = await addressesDbService.getByWalletId(command.walletId);
      const addresses = ownAddresses
        .filter((a) => inputAddresses.includes(a.script))
        .map((a) => dbAddressMapper(a));

      if (isEmpty(addresses)) {
        const changeIndex = state.currentWallet.settings.defaultChangeIndex;
        addresses.push(
          dbAddressMapper(
            find(ownAddresses, (a) => a.index === changeIndex) ??
              find(ownAddresses, (a) => a.index === 0) ??
              ownAddresses[0]
          )
        );
      }

      if (command.callback) {
        command.callback({ statusText: "Loading context data..." });
      }

      const isLedger = state.currentWallet.type === WalletType.Ledger;
      const deriver = isLedger
        ? hdKeyPool.get(state.currentWallet.publicKey)
        : await HdKey.fromMnemonic(
            await walletsDbService.getMnemonic(command.walletId, command.password)
          );

      const changeAddress = getChangeAddress(
        command.tx.outputs,
        ownAddresses.map((a) => a.script)
      );

      const blockHeaders = isLedger ? [] : await graphQLService.getBlockHeaders({ take: 10 });
      const changeIndex = find(ownAddresses, (a) => a.script === changeAddress)?.index ?? 0;
      const prover = new Prover(deriver)
        .from(addresses)
        .useLedger(isLedger)
        .changeIndex(changeIndex)
        .setHeaders(blockHeaders)
        .setCallback(command.callback);

      if (command.inputsToSign && some(command.inputsToSign)) {
        return await prover.signInputs(command.tx, command.inputsToSign);
      } else {
        return await prover.signTx(command.tx);
      }
    },
    async [ACTIONS.LOAD_CONNECTIONS]({ commit }) {
      const connections = await connectedDAppsDbService.getAll();
      commit(MUTATIONS.SET_CONNECTIONS, connections);
    },
    async [ACTIONS.REMOVE_CONNECTION]({ dispatch }, origin: string) {
      await connectedDAppsDbService.deleteByOrigin(origin);
      dispatch(ACTIONS.LOAD_CONNECTIONS);
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
    },
    async [ACTIONS.TOGGLE_HIDE_BALANCES]({ dispatch, state }) {
      dispatch(ACTIONS.SAVE_SETTINGS, { hideBalances: !state.settings.hideBalances });
    }
  }
});
