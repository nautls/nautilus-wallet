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
  findLastIndex
} from "lodash";
import { Network, WalletType, AddressState, AddressType } from "@/types/internal";
import { bip32Pool } from "@/utils/objectPool";
import { StateAddress, StateAsset, StateWallet } from "@/types/internal";
import { MUTATIONS, GETTERS, ACTIONS } from "@/constants/store";
import { setDecimals, toBigNumber } from "@/utils/bigNumbers";
import { ERG_TOKEN_ID, CHUNK_DERIVE_LENGTH } from "@/constants/ergo";
import { IDbAsset, IDbWallet } from "@/types/database";
import router from "@/router";
import { addressesDbService } from "@/api/database/addressesDbService";
import { assestsDbService } from "@/api/database/assetsDbService";

export default createStore({
  state: {
    ergPrice: 0,
    wallets: [] as StateWallet[],
    currentWallet: {
      id: 0,
      name: "",
      type: WalletType.Standard,
      publicKey: "",
      extendedPublicKey: "",
      balance: new BigNumber(0)
    } as StateWallet,
    currentAddresses: [] as StateAddress[],
    settings: {
      lastOpenedWalletId: 0
    },
    loading: {
      price: false,
      addresses: true,
      balance: true
    }
  },
  getters: {
    [GETTERS.BALANCE](state) {
      const balance: StateAsset[] = [];

      const groups = groupBy(
        state.currentAddresses
          .filter(a => a.balance)
          .map(a => a.balance || [])
          .flat(),
        a => a?.tokenId
      );

      for (const key in groups) {
        const group = groups[key];
        if (group.length === 0) {
          continue;
        }

        const token: StateAsset = {
          tokenId: group[0].tokenId,
          name: group[0].name,
          confirmedAmount: group.map(a => a.confirmedAmount).reduce((acc, val) => acc.plus(val)),
          unconfirmedAmount: group
            .map(a => a.unconfirmedAmount)
            .reduce((acc, val) => acc?.plus(val || 0)),
          price: group[0].tokenId === ERG_TOKEN_ID ? state.ergPrice : undefined
        };

        balance.push(token);
      }

      return sortBy(balance, [a => a.tokenId !== ERG_TOKEN_ID, a => a.name]);
    }
  },
  mutations: {
    [MUTATIONS.SET_CURRENT_WALLET](state, wallet: StateWallet) {
      if (!wallet.id) {
        return;
      }

      const i = findIndex(state.wallets, x => x.id == wallet.id);
      if (i > -1) {
        state.wallets[i] = wallet;
      } else {
        state.wallets.push(wallet);
      }

      state.currentWallet = wallet;
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
          const stateAddr = find(state.currentAddresses, a => a.script === address.script);
          if (stateAddr && stateAddr.balance) {
            address.balance = stateAddr.balance;
          }
        }
      }

      state.currentAddresses = sortBy(content.addresses, a => a.index);
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

      const groups = groupBy(data.assets, a => a.address);
      for (const address of state.currentAddresses) {
        const group = groups[address.script];
        if (!group || group.length === 0) {
          address.balance = undefined;
          continue;
        }

        address.balance = group.map(x => {
          return {
            tokenId: x.tokenId,
            name: x.name,
            confirmedAmount:
              setDecimals(toBigNumber(x.confirmedAmount), x.decimals) || new BigNumber(0),
            unconfirmedAmount: setDecimals(toBigNumber(x.unconfirmedAmount), x.decimals),
            price: undefined
          };
        });
      }
    },
    [MUTATIONS.SET_ERG_PRICE](state, price) {
      state.loading.price = false;
      state.ergPrice = price;
    },
    [MUTATIONS.SET_LOADING](state, obj) {
      state.loading = Object.assign(state.loading, obj);
    },
    [MUTATIONS.SET_WALLETS](state, wallets: IDbWallet[]) {
      state.wallets = wallets.map(w => {
        return {
          id: w.id || 0,
          name: w.name,
          type: w.type,
          publicKey: w.publicKey,
          extendedPublicKey: bip32Pool.get(w.publicKey).extendedPublicKey.toString("hex"),
          balance: new BigNumber(0)
        };
      });
    },
    [MUTATIONS.SET_SETTINGS](state, settings) {
      state.settings = Object.assign(state.settings, settings);
    }
  },
  actions: {
    async [ACTIONS.INIT]({ state, dispatch }) {
      dispatch(ACTIONS.LOAD_SETTINGS);
      await dispatch(ACTIONS.LOAD_WALLETS);

      if (state.wallets.length > 0) {
        let current = find(state.wallets, w => w.id === state.settings.lastOpenedWalletId);
        if (!current) {
          current = first(state.wallets);
        }
        dispatch(ACTIONS.SET_CURRENT_WALLET, current);

        router.push({ name: "assets-page" });
      } else {
        router.push({ name: "add-wallet" });
      }
    },
    [ACTIONS.LOAD_SETTINGS]({ commit }) {
      const rawSettings = localStorage.getItem("settings");
      if (rawSettings) {
        commit(MUTATIONS.SET_SETTINGS, JSON.parse(rawSettings));
      }
    },
    [ACTIONS.SAVE_SETTINGS]({ state, commit }, newSettings) {
      if (newSettings) {
        commit(MUTATIONS.SET_SETTINGS, newSettings);
      }
      localStorage.setItem("settings", JSON.stringify(state.settings));
    },
    async [ACTIONS.LOAD_WALLETS]({ commit }) {
      const wallets = await walletsDbService.getAll();
      for (const wallet of wallets) {
        bip32Pool.alloc(
          Bip32.fromPublicKey({ publicKey: wallet.publicKey, chainCode: wallet.chainCode }),
          wallet.publicKey
        );
      }

      commit(MUTATIONS.SET_WALLETS, wallets);
    },
    async [ACTIONS.PUT_WALLET](
      { dispatch },
      wallet:
        | { extendedPublicKey: string; name: string; type: WalletType.ReadOnly }
        | { seed: Buffer; name: string; type: WalletType.Standard }
    ) {
      const bip32 =
        wallet.type === WalletType.ReadOnly
          ? Bip32.fromPublicKey(wallet.extendedPublicKey)
          : Bip32.fromSeed(wallet.seed);

      bip32Pool.alloc(bip32, bip32.publicKey.toString("hex"));
      const walletId = await walletsDbService.put({
        name: wallet.name,
        network: Network.ErgoMainet,
        type: wallet.type,
        publicKey: bip32.publicKey.toString("hex"),
        chainCode: bip32.chainCode.toString("hex"),
        seed: wallet.type === WalletType.Standard ? wallet.seed.toString("hex") : undefined
      });

      await dispatch(ACTIONS.FETCH_AND_SET_AS_CURRENT_WALLET, walletId);
    },
    async [ACTIONS.FETCH_AND_SET_AS_CURRENT_WALLET]({ commit, dispatch }, id: number) {
      const wallet = await walletsDbService.getFromId(id);
      if (!wallet || !wallet.id) {
        throw Error("wallet not found");
      }

      const bip32 = bip32Pool.get(wallet.publicKey);
      const stateWallet: StateWallet = {
        id: wallet.id,
        name: wallet.name,
        type: wallet.type,
        publicKey: wallet.publicKey,
        balance: new BigNumber(0),
        extendedPublicKey: bip32.extendedPublicKey.toString("hex")
      };

      await dispatch(ACTIONS.SET_CURRENT_WALLET, stateWallet);
      await dispatch(ACTIONS.REFRESH_CURRENT_ADDRESSES);
    },
    [ACTIONS.SET_CURRENT_WALLET]({ commit, dispatch }, wallet: StateWallet) {
      commit(MUTATIONS.SET_LOADING, { balance: true, addresses: true });
      commit(MUTATIONS.SET_CURRENT_WALLET, wallet);
      commit(MUTATIONS.SET_CURRENT_ADDRESSES, { addresses: [], walletId: wallet.id });
      dispatch(ACTIONS.REFRESH_CURRENT_ADDRESSES);
      dispatch(ACTIONS.SAVE_SETTINGS, { lastOpenedWalletId: wallet.id });
    },
    async [ACTIONS.NEW_ADDRESS]({ state, commit }) {
      const lastUsedIndex = findLastIndex(
        state.currentAddresses,
        a => a.state === AddressState.Used
      );

      if (state.currentAddresses.length - lastUsedIndex > CHUNK_DERIVE_LENGTH) {
        throw Error(
          `You cannot add more than ${CHUNK_DERIVE_LENGTH} consecutive unused addresses.`
        );
      }
      const walletId = state.currentWallet.id;
      const pk = state.currentWallet.publicKey;
      const index = (maxBy(state.currentAddresses, a => a.index)?.index || 0) + 1;
      const bip32 = bip32Pool.get(pk);
      const address = bip32.deriveAddress(index);
      console.log(index);
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
      const walletId = state.currentWallet.id;
      const pk = state.currentWallet.publicKey;

      const bip32 = bip32Pool.get(pk);
      let active: StateAddress[] = sortBy(
        (await addressesDbService.getAllFromWalletId(walletId)).map(a => {
          return {
            script: a.script,
            state: a.state,
            index: a.index,
            balance: undefined
          };
        }),
        a => a.index
      );
      let derived: DerivedAddress[] = [];
      let used: string[] = [];
      let usedChunk: string[] = [];
      let lastUsed: string | undefined;
      let lastStored = last(active)?.script;
      const maxIndex = maxBy(active, a => a.index)?.index;
      let offset = maxIndex !== undefined ? maxIndex + 1 : 0;

      if (active.length > 0) {
        if (state.currentAddresses.length === 0) {
          commit(MUTATIONS.SET_CURRENT_ADDRESSES, { addresses: clone(active), walletId });
          dispatch(ACTIONS.LOAD_BALANCES, walletId);
        }

        used = used.concat(
          await explorerService.getUsedAddresses(
            active.map(a => a.script),
            { chunkBy: CHUNK_DERIVE_LENGTH }
          )
        );
        lastUsed = last(used);
      }

      do {
        derived = bip32.deriveAddresses(CHUNK_DERIVE_LENGTH, offset);
        offset += derived.length;
        usedChunk = await explorerService.getUsedAddresses(derived.map(a => a.script));
        used = used.concat(usedChunk);
        active = active.concat(
          derived.map(d => ({
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

      const lastUsedIndex = findIndex(active, a => a.script === lastUsed);
      const lastStoredIndex = findIndex(active, a => a.script === lastStored);
      if (lastStoredIndex > lastUsedIndex) {
        active = take(active, lastStoredIndex + 1);
      } else if (lastUsedIndex > -1) {
        active = take(active, lastUsedIndex + 2);
      } else {
        active = take(active, 1);
      }

      for (const addr of active) {
        if (find(used, address => addr.script === address)) {
          addr.state = AddressState.Used;
        }
      }

      await addressesDbService.bulkPut(
        active.map(a => {
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

      const addr = (await addressesDbService.getAllFromWalletId(walletId)).map(a => {
        return {
          script: a.script,
          state: a.state,
          index: a.index,
          balance: undefined
        };
      });
      commit(MUTATIONS.SET_CURRENT_ADDRESSES, { addresses: addr, walletId: walletId });

      if (lastUsed !== null) {
        dispatch(ACTIONS.REFRESH_BALANCES, {
          addresses: active.map(a => a.script),
          walletId
        });
      }

      commit(MUTATIONS.SET_LOADING, { addresses: false });
    },
    async [ACTIONS.LOAD_BALANCES]({ commit }, walletId: number) {
      const assets = await assestsDbService.getAllFromWalletId(walletId);
      commit(MUTATIONS.UPDATE_BALANCES, { assets, walletId: walletId });
    },
    async [ACTIONS.REFRESH_BALANCES]({ commit }, data: { addresses: string[]; walletId: number }) {
      const balances = await explorerService.getAddressesBalance(data.addresses);
      const assets = assestsDbService.parseAddressBalanceAPIResponse(balances, data.walletId);
      assestsDbService.sync(assets, data.walletId);

      commit(MUTATIONS.UPDATE_BALANCES, { assets, walletId: data.walletId });
      commit(MUTATIONS.SET_LOADING, { balance: false });
    },
    async [ACTIONS.FETCH_CURRENT_PRICES]({ commit, state }) {
      if (state.loading.price) {
        return;
      }

      state.loading.price = true;
      const responseData = await coinGeckoService.getPrice();
      commit(MUTATIONS.SET_ERG_PRICE, responseData.ergo.usd);
    }
  }
});
