import { SendTxCommand } from "@/types/internal";
import { wasmModule } from "@/utils/wasm-module";
import { walletsDbService } from "../database/walletsDbService";
import { explorerService } from "../explorer/explorerService";
import Bip32 from "./bip32";

export async function signTx(command: SendTxCommand): Promise<string> {
  const bip32 = await Bip32.fromMnemonic(
    await walletsDbService.getMnemonic(command.walletId, command.password)
  );

  const firstUnusedAddressFromDb = await walletsDbService.getFirstUnusedAddress(command.walletId);
  const changeAddress = firstUnusedAddressFromDb?.script || bip32.deriveAddress(0).script;
  const recipientAddress = bip32.deriveAddress(1).script;

  const boxes = await explorerService.getUnspentBoxes(bip32.deriveAddress(0).script);

  const sigmaRust = wasmModule.SigmaRust;
  const recipient = sigmaRust.Address.from_mainnet_str(recipientAddress);
  const unspentBoxes = sigmaRust.ErgoBoxes.from_boxes_json(boxes.data);
  const contract = sigmaRust.Contract.pay_to_address(recipient);
  const outbox_value = sigmaRust.BoxValue.SAFE_USER_MIN();
  const outbox = new sigmaRust.ErgoBoxCandidateBuilder(outbox_value, contract, 0).build();
  const tx_outputs = new sigmaRust.ErgoBoxCandidates(outbox);
  const fee = sigmaRust.TxBuilder.SUGGESTED_TX_FEE();
  const change_address = sigmaRust.Address.from_mainnet_str(changeAddress);
  const min_change_value = sigmaRust.BoxValue.SAFE_USER_MIN();
  const box_selector = new sigmaRust.SimpleBoxSelector();
  const target_balance = sigmaRust.BoxValue.from_i64(
    outbox_value.as_i64().checked_add(fee.as_i64())
  );
  const box_selection = box_selector.select(unspentBoxes, target_balance, new sigmaRust.Tokens());
  const tx_builder = sigmaRust.TxBuilder.new(
    box_selection,
    tx_outputs,
    0,
    fee,
    change_address,
    min_change_value
  );

  const unsigned = tx_builder.build();

  const sk = sigmaRust.SecretKey.dlog_from_bytes(bip32.derivePrivateKey(0));
  // console.log(changeAddress);
  // console.log(sk.get_address().to_base58(sigmaRust.NetworkPrefix.Mainnet));
  const sks = new sigmaRust.SecretKeys();
  sks.add(sk);
  const wallet = sigmaRust.Wallet.from_secrets(sks);

  const blocks = await explorerService.getLastTenBlockHeaders();
  const blockHeaders = sigmaRust.BlockHeaders.from_json(blocks);
  const pre_header = sigmaRust.PreHeader.from_block_header(blockHeaders.get(0));
  const ctx = new sigmaRust.ErgoStateContext(pre_header, blockHeaders);
  const signed = wallet.sign_transaction(
    ctx,
    unsigned,
    unspentBoxes,
    sigmaRust.ErgoBoxes.from_boxes_json([])
  );

  return signed.to_json();
}
