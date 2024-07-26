import { createStore } from "vuex";
import AES from "crypto-js/aes";
import { hex } from "@fleet-sdk/crypto";
import { walletsDbService } from "@/database/walletsDbService";
import HdKey from "@/chains/ergo/hdKey";
import { Network, WalletType } from "@/types/internal";
import { hdKeyPool } from "@/common/objectPool";
import { ACTIONS } from "@/constants/store";

export default createStore({
  state: {},
  mutations: {},
  actions: {
    async [ACTIONS.PUT_WALLET](
      _,
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
    }
  }
});
