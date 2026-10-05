import { ErgoHDKey } from "@fleet-sdk/wallet";

export type TestWallet = {
  name: string;
  mnemonic: string;
  password: string;
};

export const WALLET_A: TestWallet = {
  name: "Alice",
  mnemonic:
    "enough table opinion toilet outside bundle current frame mouse vague wagon close whip total nominee",
  password: "correct horse battery"
};

export const WALLET_B: TestWallet = {
  name: "Bob",
  mnemonic:
    "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
  password: "battery staple horse"
};

export const RECIPIENT_ADDRESS = "9hoMQn9KqARhFHkgn3ua1rzDfrXDFife5iBFFa3pzYwgKVhvXBT";

/** EIP-4 fungible token held by funded test wallets. */
export const TEST_TOKEN = {
  tokenId: "6f7323962906744e007494df425278df447ef1a08bf73bd5cdbb9e40c353991f",
  name: "TestToken",
  decimals: 2
};

/** EIP-4 picture NFT held by funded test wallets. */
export const TEST_NFT = {
  tokenId: "a5b1c7e1f0f8a3d0f6b2c9e4d1a8b7c6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0",
  name: "Nautilus NFT",
  decimals: 0,
  registers: {
    R7: "0e020101", // Coll[Byte](0x01, 0x01) => picture artwork
    R9: "0e1668747470733a2f2f6e66742e746573742f612e706e67" // "https://nft.test/a.png"
  }
};

const keyCache = new Map<string, ErgoHDKey>();

async function changeKey(wallet: TestWallet): Promise<ErgoHDKey> {
  let key = keyCache.get(wallet.mnemonic);
  if (!key) {
    key = await ErgoHDKey.fromMnemonic(wallet.mnemonic);
    keyCache.set(wallet.mnemonic, key);
  }

  return key;
}

/** Derives the P2PK address at `m/44'/429'/0'/0/{index}`. */
export async function addressOf(wallet: TestWallet, index = 0): Promise<string> {
  return (await changeKey(wallet)).deriveChild(index).address.encode();
}

/** Base58 extended public key of the wallet's change derivation path. */
export async function xpubOf(wallet: TestWallet): Promise<string> {
  return (await changeKey(wallet)).extendedPublicKey;
}
