import { walletDbService } from "@/api/database/walletDbService";
import { createStore } from "vuex";
import Bip32, { DerivedAddress } from "@/api/ergo/bip32";
import { explorerService } from "@/api/explorer/explorerService";
import BigNumber from "bignumber.js";
import { coinGeckoService } from "@/api/coinGeckoService";
import { groupBy, sortBy, find, findIndex, last, take, first } from "lodash";
import { Network, WalletType, AddressState } from "@/types";
import { bip32Pool } from "@/utils/objectPool";
import { StateAddress, StateWallet } from "@/store/stateTypes";
import { MUTATIONS, GETTERS, ACTIONS } from "@/constants/store";
import { setDecimals, sumBigNumberBy, toBigNumber } from "@/utils/numbersUtil";
import { ERG_TOKEN_ID, ERG_DECIMALS } from "@/constants/ergo";
import { IDbWallet } from "@/db/dbTypes";
import router from "@/router";

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
      addresses: false,
      balance: false
    }
  },
  getters: {
    [GETTERS.ASSETS_BALANCE](state) {
      type AssetBalanceType = {
        tokenId: string;
        amount: BigNumber;
        decimals: number;
        name: string;
        price?: number;
      };

      const balance: AssetBalanceType[] = [];
      const tokenGroups = groupBy(
        state.currentAddresses
          .filter(a => a.balance && a.balance.tokens)
          .map(a => a.balance.tokens as AssetBalanceType)
          .flat(),
        t => t.tokenId
      );

      for (const key in tokenGroups) {
        const token = Object.create(tokenGroups[key][0]);
        token.amount = sumBigNumberBy(tokenGroups[key], t => toBigNumber(t.amount));
        if (token.decimals > 0) {
          token.amount = setDecimals(token.amount, token.decimals);
        }

        balance.push(token);
      }

      const sortedBalance = sortBy(balance, t => t.name);
      sortedBalance.unshift({
        name: "ERG",
        amount: state.currentWallet.balance,
        decimals: ERG_DECIMALS,
        tokenId: ERG_TOKEN_ID,
        price: state.ergPrice
      });

      return sortedBalance;
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
    [MUTATIONS.SET_CURRENT_ADDRESSES](state, addresses: StateAddress[]) {
      state.currentAddresses = addresses;
    },
    [MUTATIONS.UPDATE_BALANCES](state, balances: { address: string; data: any }[]) {
      let walletNanoErgs = new BigNumber(0);
      for (const address of state.currentAddresses) {
        const balance = find(balances, b => b.address === address.address);
        if (balance) {
          address.balance = balance.data;
          walletNanoErgs = walletNanoErgs.plus(address.balance.nanoErgs);
        } else {
          address.balance = undefined;
        }
      }

      state.currentWallet.balance = setDecimals(walletNanoErgs, ERG_DECIMALS);
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
          id: w.id,
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
      const wallets = await walletDbService.all();
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
      wallet: { extendedPublicKey: string; name: string; type: WalletType }
    ) {
      const bip32 = Bip32.fromPublicKey(wallet.extendedPublicKey);
      bip32Pool.alloc(bip32, bip32.publicKey.toString("hex"));

      const walletId = await walletDbService.put({
        name: wallet.name,
        network: Network.ErgoMainet,
        type: wallet.type,
        publicKey: bip32.publicKey.toString("hex"),
        chainCode: bip32.chainCode.toString("hex"),
        privateKey: bip32.privateKey?.toString("hex")
      });

      await dispatch(ACTIONS.FETCH_AND_SET_AS_CURRENT_WALLET, walletId);
    },
    async [ACTIONS.FETCH_AND_SET_AS_CURRENT_WALLET]({ commit, dispatch }, id: number) {
      const wallet = await walletDbService.getFromId(id);
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
      commit(MUTATIONS.SET_LOADING, { addresses: true });
      commit(MUTATIONS.SET_CURRENT_ADDRESSES, []);
      commit(MUTATIONS.SET_CURRENT_WALLET, wallet);
      dispatch(ACTIONS.REFRESH_CURRENT_ADDRESSES);
      dispatch(ACTIONS.SAVE_SETTINGS, { lastOpenedWalletId: wallet.id });
    },
    async [ACTIONS.REFRESH_CURRENT_ADDRESSES]({ state, commit, dispatch }) {
      const bip32 = bip32Pool.get(state.currentWallet.publicKey);
      let active: StateAddress[] = [];
      let derived: DerivedAddress[] = [];
      let used: string[] = [];
      let usedChunk: string[] = [];
      let lastUsed: string | undefined;
      let counter = 0;

      do {
        derived = bip32.deriveAddresses(20, counter * 20);
        usedChunk = await explorerService.getUsedAddressesFrom(derived.map(x => x.address));
        used = used.concat(usedChunk);
        active = active.concat(
          derived.map(d => ({
            index: d.index,
            address: d.address,
            state: AddressState.Unused,
            balance: 0
          }))
        );
        if (usedChunk.length > 0) {
          lastUsed = last(usedChunk);
        }

        counter++;
      } while (usedChunk.length > 0);

      if (lastUsed) {
        active = take(active, findIndex(active, a => a.address == lastUsed) + 1);
      } else {
        active = take(active, 1);
      }

      for (const addr of active) {
        if (find(used, address => addr.address === address)) {
          addr.state = AddressState.Used;
        }
      }

      commit(MUTATIONS.SET_CURRENT_ADDRESSES, active);

      if (lastUsed !== null) {
        commit(MUTATIONS.SET_LOADING, { balance: true });
        dispatch(
          ACTIONS.REFRESH_BALANCES,
          active.filter(a => a.state === AddressState.Used).map(a => a.address)
        );
      }

      commit(MUTATIONS.SET_LOADING, { addresses: false });
    },
    async [ACTIONS.REFRESH_BALANCES]({ state, commit }, addresses: string[] | undefined) {
      const balance = await explorerService.getAddressesBalance(
        addresses ? addresses : state.currentAddresses.map(a => a.address)
      );

      commit(MUTATIONS.UPDATE_BALANCES, balance);
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
