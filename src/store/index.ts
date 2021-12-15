import { walletDbService } from "@/api/database/walletDbService";
import { createStore } from "vuex";
import Bip32, { DerivedAddress } from "@/api/ergo/bip32";
import { explorerService } from "@/api/explorer/explorerService";
import BigNumber from "bignumber.js";
import { unitsInOneErgo } from "@/api/constants";
import { coinGeckoService } from "@/api/coinGeckoService";
import { groupBy, sumBy, sortBy, find, findIndex, last, take } from "lodash";
import { Network, WalletType, AddressState } from "@/types";
import { bip32Pool } from "@/utils/objectPool";

type StateAddress = {
  address: string;
  state: AddressState;
  index: number;
  balance: any;
};

type StateWallet = {
  id: number;
  name: string;
  type: WalletType;
  publicKey: string;
  extendedPublicKey: string;
  balance: BigNumber;
  // addresses: AddressType[];
};

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
    currentAddresses: [] as StateAddress[]
  },
  getters: {
    ergBalance(state) {
      return state.currentWallet.balance.toFormat();
    },
    fiatBalance(state) {
      return state.currentWallet.balance.multipliedBy(state.ergPrice).toFormat(2);
    },
    assetsBalance(state) {
      type TokenBalanceType = {
        tokenId: string;
        amount: number;
        decimals: number;
        name: string;
      };

      const balance: TokenBalanceType[] = [];
      const tokenGroups = groupBy(
        state.currentAddresses
          .filter(a => a.balance && a.balance.tokens)
          .map(a => a.balance.tokens as TokenBalanceType)
          .flat(),
        t => t.tokenId
      );

      for (const key in tokenGroups) {
        const token = Object.create(tokenGroups[key][0]);
        token.amount = sumBy(tokenGroups[key], t => t.amount);
        if (token.decimals > 0) {
          token.amount = token.amount * Math.pow(10, token.decimals * -1);
        }
        balance.push(token);
      }

      return sortBy(balance, t => t.name);
    }
  },
  mutations: {
    setCurrentWallet(state, wallet: StateWallet) {
      if (!wallet.id) {
        return;
      }

      state.currentWallet = wallet;
    },
    setAddresses(state, addresses: StateAddress[]) {
      state.currentAddresses = addresses;
    },
    updateBalances(state, balances: { address: string; data: any }[]) {
      for (const bal of balances) {
        for (const address of state.currentAddresses) {
          if (bal.address === address.address) {
            address.balance = bal.data;
          }
        }
      }
    },
    calcTotalBalance(state) {
      let balance = new BigNumber(0);
      for (const addr of state.currentAddresses) {
        if (addr.balance) {
          balance = balance.plus(addr.balance.nanoErgs);
        }
      }

      state.currentWallet.balance = balance.div(unitsInOneErgo);
    },
    setPrice(state, price) {
      state.ergPrice = price;
    }
  },
  actions: {
    async putWallet(
      context,
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

      await context.dispatch("setCurrentWallet", walletId);
      await context.dispatch("refreshCurrentAddresses");
    },
    async setCurrentWallet(context, id: number) {
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

      context.commit("setCurrentWallet", stateWallet);
    },
    async refreshCurrentAddresses(context) {
      const bip32 = bip32Pool.get(context.state.currentWallet.publicKey);
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

      context.commit("setAddresses", active);

      if (lastUsed !== null) {
        context.dispatch(
          "refreshBalances",
          active.filter(a => a.state === AddressState.Used).map(a => a.address)
        );
      }
      context.dispatch("getCurrentPrice");
    },
    async refreshBalances(context, addresses: string[] | undefined) {
      const balance = await explorerService.getAddressesBalance(
        addresses ? addresses : context.state.currentAddresses.map(a => a.address)
      );

      context.commit("updateBalances", balance);
      context.commit("calcTotalBalance");
    },
    async getCurrentPrice(context) {
      const responseData = await coinGeckoService.getPrice();
      context.commit("setPrice", responseData.ergo.usd);
    }
  }
});
