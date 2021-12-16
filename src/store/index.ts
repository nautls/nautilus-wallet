import { walletDbService } from "@/api/database/walletDbService";
import { createStore } from "vuex";
import Bip32, { DerivedAddress } from "@/api/ergo/bip32";
import { explorerService } from "@/api/explorer/explorerService";
import BigNumber from "bignumber.js";
import { coinGeckoService } from "@/api/coinGeckoService";
import { groupBy, sortBy, find, findIndex, last, take } from "lodash";
import { Network, WalletType, AddressState } from "@/types";
import { bip32Pool } from "@/utils/objectPool";
import { StateAddress, StateWallet } from "@/store/stateTypes";
import {
  CALC_TOTAL_ERG_BALANCE,
  SET_CURRENT_ADDRESSES,
  SET_CURRENT_WALLET,
  SET_ERG_PRICE,
  UPDATE_ADDRESSES_BALANCES
} from "@/constants/store/mutations";
import { ASSETS_BALANCE, ERG_BALANCE, FIAT_BALANCE } from "@/constants/store/getters";
import {
  FETCH_CURRENT_WALLET,
  FETCH_CURRENT_PRICES,
  PUT_WALLET,
  REFRESH_BALANCES,
  REFRESH_CURRENT_ADDRESSES
} from "@/constants/store/actions";
import { setDecimals, sumBigNumberBy, toBigNumber } from "@/utils/numbersUtil";
import { ERG_TOKEN_ID, ERG_DECIMALS } from "@/constants/ergo";

export default createStore({
  state: {
    ergPrice: 0,
    currentWallet: {
      id: 0,
      name: "",
      type: WalletType.Standard,
      publicKey: "",
      extendedPublicKey: "",
      balance: new BigNumber(0)
    } as StateWallet,
    currentAddresses: [] as StateAddress[],
    loading: {
      price: false
    }
  },
  getters: {
    [ERG_BALANCE](state) {
      return state.currentWallet.balance.toFormat();
    },
    [FIAT_BALANCE](state) {
      return state.currentWallet.balance.multipliedBy(state.ergPrice).toFormat(2);
    },
    [ASSETS_BALANCE](state) {
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
    [SET_CURRENT_WALLET](state, wallet: StateWallet) {
      if (!wallet.id) {
        return;
      }

      state.currentWallet = wallet;
    },
    [SET_CURRENT_ADDRESSES](state, addresses: StateAddress[]) {
      state.currentAddresses = addresses;
    },
    [UPDATE_ADDRESSES_BALANCES](state, balances: { address: string; data: any }[]) {
      for (const bal of balances) {
        for (const address of state.currentAddresses) {
          if (bal.address === address.address) {
            address.balance = bal.data;
          }
        }
      }
    },
    [CALC_TOTAL_ERG_BALANCE](state) {
      let balance = new BigNumber(0);
      for (const addr of state.currentAddresses) {
        if (addr.balance) {
          balance = balance.plus(addr.balance.nanoErgs);
        }
      }

      state.currentWallet.balance = setDecimals(balance, ERG_DECIMALS);
    },
    [SET_ERG_PRICE](state, price) {
      state.ergPrice = price;
    }
  },
  actions: {
    async [PUT_WALLET](
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

      await dispatch(FETCH_CURRENT_WALLET, walletId);
      await dispatch(REFRESH_CURRENT_ADDRESSES);
    },
    async [FETCH_CURRENT_WALLET]({ commit }, id: number) {
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

      commit(SET_CURRENT_WALLET, stateWallet);
    },
    async [REFRESH_CURRENT_ADDRESSES]({ state, commit, dispatch }) {
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

      commit(SET_CURRENT_ADDRESSES, active);

      if (lastUsed !== null) {
        dispatch(
          REFRESH_BALANCES,
          active.filter(a => a.state === AddressState.Used).map(a => a.address)
        );
      }
    },
    async [REFRESH_BALANCES]({ state, commit }, addresses: string[] | undefined) {
      const balance = await explorerService.getAddressesBalance(
        addresses ? addresses : state.currentAddresses.map(a => a.address)
      );

      commit(UPDATE_ADDRESSES_BALANCES, balance);
      commit(CALC_TOTAL_ERG_BALANCE);
    },
    async [FETCH_CURRENT_PRICES]({ commit, state }) {
      if (state.loading.price) {
        return;
      }

      const responseData = await coinGeckoService.getPrice();
      commit(SET_ERG_PRICE, responseData.ergo.usd);
    }
  }
});
