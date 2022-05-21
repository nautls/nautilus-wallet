import { walletsDbService } from "@/api/database/walletsDbService";
import { createStore } from "vuex";
import Bip32, { DerivedAddress } from "@/api/ergo/bip32";
import { explorerService } from "@/api/explorer/explorerService";
import BigNumber from "bignumber.js";
import { coinGeckoService } from "@/api/coinGeckoService";
import {
  groupBy,
  sortBy,
  find,
  findIndex,
  last,
  take,
  first,
  maxBy,
  clone,
  findLastIndex,
  isEmpty,
  uniq,
  difference,
  union
} from "lodash";
import {
  Network,
  WalletType,
  AddressState,
  AddressType,
  SendTxCommand,
  SignTxFromConnectorCommand,
  UpdateWalletSettingsCommand,
  UpdateChangeIndexCommand,
  UpdateUsedAddressesFilterCommand,
  StateAssetInfo,
  AssetType,
  AssetSubtype
} from "@/types/internal";
import { bip32Pool } from "@/utils/objectPool";
import { StateAddress, StateAsset, StateWallet } from "@/types/internal";
import { MUTATIONS, GETTERS, ACTIONS } from "@/constants/store";
import { decimalize, toBigNumber } from "@/utils/bigNumbers";
import {
  ERG_TOKEN_ID,
  CHUNK_DERIVE_LENGTH,
  ERG_DECIMALS,
  UNKNOWN_MINTING_BOX_ID
} from "@/constants/ergo";
import { IDbAddress, IDbAsset, IAssetInfo, IDbDAppConnection, IDbWallet } from "@/types/database";
import router from "@/router";
import { addressesDbService } from "@/api/database/addressesDbService";
import { assestsDbService } from "@/api/database/assetsDbService";
import AES from "crypto-js/aes";
import { TxBuilder } from "././api/ergo/transaction/txBuilder";
import { SignContext } from "./api/ergo/transaction/signContext";
import { connectedDAppsDbService } from "./api/database/connectedDAppsDbService";
import { rpcHandler } from "./background/rpcHandler";
import {
  extractAddressesFromInputs as extractP2PKAddressesFromInputs,
  getChangeAddress
} from "./api/ergo/addresses";
import { submitTx } from "./api/ergo/submitTx";
import { fetchBoxes } from "./api/ergo/boxFetcher";
import { utxosDbService } from "./api/database/utxosDbService";
import { MIN_UTXO_SPENT_CHECK_TIME } from "./constants/intervals";
import { assetInfoDbService } from "./api/database/assetInfoDbService";
import { Token } from "./types/connector";
import { AssetPriceRate } from "./types/explorer";

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
      conversionCurrency: "usd"
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
        const group = groups[key];
        if (group.length === 0) {
          continue;
        }

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
          extendedPublicKey: bip32Pool.get(w.publicKey).extendedPublicKey.toString("hex"),
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

      for (let info of assetsInfo) {
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
      dispatch(ACTIONS.LOAD_SETTINGS);
      dispatch(ACTIONS.FETCH_FULL_ASSETS_INFO);
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
      const tokenMarketRates = await explorerService.getTokenRates();
      commit(MUTATIONS.SET_MARKET_RATES, tokenMarketRates);
    },
    [ACTIONS.LOAD_SETTINGS]({ commit }) {
      const rawSettings = localStorage.getItem("settings");
      if (rawSettings) {
        commit(MUTATIONS.SET_SETTINGS, JSON.parse(rawSettings));
      }
      commit(MUTATIONS.SET_LOADING, { settings: false });
    },
    [ACTIONS.SAVE_SETTINGS]({ state, commit }, newSettings) {
      if (newSettings) {
        commit(MUTATIONS.SET_SETTINGS, newSettings);
      }
      localStorage.setItem("settings", JSON.stringify(state.settings));
    },
    async [ACTIONS.LOAD_WALLETS]({ commit }) {
      const wallets = await walletsDbService.getAll();
      if (isEmpty(wallets)) {
        return;
      }

      for (const wallet of wallets) {
        bip32Pool.alloc(
          Bip32.fromPublicKey({ publicKey: wallet.publicKey, chainCode: wallet.chainCode }),
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
      const bip32 =
        wallet.type === WalletType.Standard
          ? await Bip32.fromMnemonic(wallet.mnemonic)
          : Bip32.fromPublicKey(wallet.extendedPublicKey);

      bip32Pool.alloc(bip32.neutered(), bip32.publicKey.toString("hex"));
      const walletId = await walletsDbService.put({
        name: wallet.name.trim(),
        network: Network.ErgoMainet,
        type: wallet.type,
        publicKey: bip32.publicKey.toString("hex"),
        chainCode: bip32.chainCode.toString("hex"),
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

      const bip32 = bip32Pool.get(wallet.publicKey);
      const stateWallet: StateWallet = {
        id: wallet.id,
        name: wallet.name,
        type: wallet.type,
        publicKey: wallet.publicKey,
        extendedPublicKey: bip32.extendedPublicKey.toString("hex"),
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
      const bip32 = bip32Pool.get(pk);
      const address = bip32.deriveAddress(index);
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
      const bip32 = bip32Pool.get(pk);
      let active: StateAddress[] = sortBy(
        (await addressesDbService.getByWalletId(walletId)).map((a) => dbAddressMapper(a)),
        (a) => a.index
      );
      let derived: DerivedAddress[] = [];
      let used: string[] = [];
      let usedChunk: string[] = [];
      let lastUsed: string | undefined;
      let lastStored = last(active)?.script;
      const maxIndex = maxBy(active, (a) => a.index)?.index;
      let offset = maxIndex !== undefined ? maxIndex + 1 : 0;

      if (active.length > 0) {
        if (state.currentAddresses.length === 0) {
          commit(MUTATIONS.SET_CURRENT_ADDRESSES, { addresses: clone(active), walletId });
          dispatch(ACTIONS.LOAD_BALANCES, walletId);
        }

        used = used.concat(
          await explorerService.getUsedAddresses(
            active.map((a) => a.script),
            { chunkBy: CHUNK_DERIVE_LENGTH }
          )
        );
        lastUsed = last(used);
      }

      do {
        derived = bip32.deriveAddresses(CHUNK_DERIVE_LENGTH, offset);
        offset += derived.length;
        usedChunk = await explorerService.getUsedAddresses(derived.map((a) => a.script));
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
      const assets = await assestsDbService.getByWalletId(walletId);

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

      let info = await explorerService.getAssetsInfo(incompleteIds);
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
      const balances = await explorerService.getAddressesBalance(data.addresses);
      const assets = balances.map((x) => {
        return {
          tokenId: x.tokenId,
          confirmedAmount: x.confirmedAmount,
          unconfirmedAmount: x.unconfirmedAmount,
          address: x.address,
          walletId: data.walletId
        } as IDbAsset;
      });
      assestsDbService.sync(assets, data.walletId);

      await dispatch(ACTIONS.LOAD_ASSETS_INFO, {
        assetInfo: balances.map((x) => {
          return {
            tokenId: x.tokenId,
            name: x.name,
            decimals: x.decimals
          } as Token;
        })
      });
      commit(MUTATIONS.UPDATE_BALANCES, { assets, walletId: data.walletId });
      commit(MUTATIONS.SET_LOADING, { balance: false });
      dispatch(ACTIONS.CHECK_PENDING_BOXES);
    },
    async [ACTIONS.CHECK_PENDING_BOXES]() {
      const now = Date.now();
      const boxes = (await utxosDbService.getAllPending()).filter(
        (b) => b.spentTimestamp && now - b.spentTimestamp >= MIN_UTXO_SPENT_CHECK_TIME
      );

      if (isEmpty(boxes)) {
        return;
      }

      const txIds = uniq(boxes.map((b) => b.spentTxId));
      const mempoolResult = await explorerService.areTransactionsInMempool(txIds);
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
    async [ACTIONS.SEND_TX]({ dispatch, state }, command: SendTxCommand) {
      if (state.currentWallet.settings.avoidAddressReuse) {
        let unused = find(
          state.currentAddresses,
          (a) => a.state === AddressState.Unused && a.script !== command.recipient
        );
        if (!unused) {
          await dispatch(ACTIONS.NEW_ADDRESS);
        }
      }

      if (command.callback) {
        command.callback({ statusText: "Loading data from the blockchain..." } as any);
      }

      const addresses = state.currentAddresses;
      const walletType = state.currentWallet.type;
      const selectedAddresses = addresses.filter((a) => a.state === AddressState.Used && a.balance);
      const bip32 =
        walletType === WalletType.Ledger
          ? bip32Pool.get(state.currentWallet.publicKey)
          : await Bip32.fromMnemonic(
              await walletsDbService.getMnemonic(command.walletId, command.password)
            );
      command.password = "";

      const changeAddress = state.currentWallet.settings.avoidAddressReuse
        ? find(addresses, (a) => a.state === AddressState.Unused && a.script !== command.recipient)
            ?.index ?? state.currentWallet.settings.defaultChangeIndex
        : state.currentWallet.settings.defaultChangeIndex;

      const boxes = await fetchBoxes(command.walletId);
      const blockHeaders = await explorerService.getBlockHeaders({ limit: 10 });

      const signedtx = await TxBuilder.from(selectedAddresses)
        .to(command.recipient)
        .changeIndex(changeAddress ?? 0)
        .withAssets(command.assets)
        .withFee(command.fee)
        .fromBoxes(boxes)
        .useLedger(walletType === WalletType.Ledger)
        .setCallback(command.callback)
        .sign(SignContext.fromBlockHeaders(blockHeaders).withBip32(bip32));

      return await submitTx(signedtx, command.walletId);
    },
    async [ACTIONS.SIGN_TX_FROM_CONNECTOR]({ state }, command: SignTxFromConnectorCommand) {
      const inputAddresses = extractP2PKAddressesFromInputs(command.tx.inputs);
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
        command.callback({ statusText: "Loading data from the blockchain..." } as any);
      }

      const walletType = state.currentWallet.type;
      const bip32 =
        walletType === WalletType.Ledger
          ? bip32Pool.get(state.currentWallet.publicKey)
          : await Bip32.fromMnemonic(
              await walletsDbService.getMnemonic(command.walletId, command.password)
            );
      command.password = "";

      const changeAddress = getChangeAddress(
        command.tx.outputs,
        ownAddresses.map((a) => a.script)
      );
      const blockHeaders = await explorerService.getBlockHeaders({ limit: 10 });
      const signedtx = await TxBuilder.from(addresses)
        .useLedger(walletType === WalletType.Ledger)
        .changeIndex(find(ownAddresses, (a) => a.script === changeAddress)?.index ?? 0)
        .setCallback(command.callback)
        .signFromConnector(command.tx, SignContext.fromBlockHeaders(blockHeaders).withBip32(bip32));

      return signedtx;
    },

    async [ACTIONS.LOAD_CONNECTIONS]({ commit }) {
      const connections = await connectedDAppsDbService.getAll();
      commit(MUTATIONS.SET_CONNECTIONS, connections);
    },
    async [ACTIONS.REMOVE_CONNECTION]({ dispatch }, origin: string) {
      await connectedDAppsDbService.deleteByOrigin(origin);
      dispatch(ACTIONS.LOAD_CONNECTIONS);
      rpcHandler.sendEvent("disconnected", origin);
    },
    async [ACTIONS.UPDATE_WALLET_SETTINGS]({ commit }, commad: UpdateWalletSettingsCommand) {
      await walletsDbService.updateSettings(commad.walletId, commad.name, commad);
      commit(MUTATIONS.SET_WALLET_SETTINGS, commad);
    },
    async [ACTIONS.UPDATE_CHANGE_ADDRESS_INDEX]({ commit }, commad: UpdateChangeIndexCommand) {
      await walletsDbService.updateChangeIndex(commad.walletId, commad.index);
      commit(MUTATIONS.SET_DEFAULT_CHANGE_INDEX, commad);
    },
    async [ACTIONS.UPDATE_USED_ADDRESSES_FILTER](
      { commit },
      commad: UpdateUsedAddressesFilterCommand
    ) {
      await walletsDbService.updateUsedAddressFilter(commad.walletId, commad.filter);
      commit(MUTATIONS.SET_USED_ADDRESSES_FILTER, commad);
    }
  }
});
