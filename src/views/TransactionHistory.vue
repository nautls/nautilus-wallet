<script setup lang="ts">
import {
  ChainProviderConfirmedTransaction,
  ChainProviderUnconfirmedTransaction
} from "@fleet-sdk/blockchain-providers";
import { computed, onMounted, shallowRef } from "vue";
import { BoxSummary, chunk, orderBy, some, TokenAmount, uniqBy, utxoDiff } from "@fleet-sdk/common";
import { BigNumber } from "bignumber.js";
import { ErgoAddress, FEE_CONTRACT } from "@fleet-sdk/core";
import { useWalletStore } from "@/stores/walletStore";
import { graphQLService } from "@/chains/ergo/services/graphQlService";
import { bn } from "@/common/bigNumber";
import { ERG_TOKEN_ID } from "@/constants/ergo";

type TransactionSummary = {
  transactionId: string;
  timestamp: number;
  fee: BigNumber;
  delta: TokenAmount<BigNumber>[];
};

type ConfirmedTransactionSummary = TransactionSummary & {
  confirmed: true;
  height: number;
};

type UnconfirmedTransactionSummary = TransactionSummary & {
  confirmed: false;
  transaction: ChainProviderUnconfirmedTransaction<string>;
};

const wallet = useWalletStore();

const unconfirmed = shallowRef<UnconfirmedTransactionSummary[]>([]);
const confirmed = shallowRef<ConfirmedTransactionSummary[]>([]);

const history = computed(() =>
  orderBy(
    uniqBy([...unconfirmed.value, ...confirmed.value], (x) => x.transactionId, "keep-last"),
    (x) => x.timestamp,
    "desc"
  )
);

onMounted(async () => {
  const addresses = wallet.addresses.map((x) => x.script);
  const ergoTrees = new Set(addresses.map((x) => ErgoAddress.decodeUnsafe(x).ergoTree));

  unconfirmed.value = (
    await graphQLService.getUnconfirmedTransactions({ where: { addresses } })
  ).map((x) => summarizeTransaction(x, ergoTrees));

  for await (const chunk of loadConfirmedTransactions(addresses)) {
    confirmed.value = [...confirmed.value, ...chunk.map((x) => summarizeTransaction(x, ergoTrees))];
  }
});

async function* loadConfirmedTransactions(addresses: string[]) {
  const chucks = chunk(addresses, 20);
  for (const chunk of chucks) {
    for await (const data of graphQLService.streamConfirmedTransactions({
      where: { addresses: chunk }
    })) {
      if (some(data)) yield data;
      break; // only takes the first batch
    }
  }
}

function summarizeTransaction(
  transaction: ChainProviderConfirmedTransaction<string>,
  ergoTrees: Set<string>
): ConfirmedTransactionSummary;
// eslint-disable-next-line no-redeclare
function summarizeTransaction(
  transaction: ChainProviderUnconfirmedTransaction<string>,
  ergoTrees: Set<string>
): UnconfirmedTransactionSummary;
// eslint-disable-next-line no-redeclare
function summarizeTransaction(
  transaction:
    | ChainProviderConfirmedTransaction<string>
    | ChainProviderUnconfirmedTransaction<string>,
  ergoTrees: Set<string>
): ConfirmedTransactionSummary | UnconfirmedTransactionSummary {
  const ownInputs = transaction.inputs.filter((x) => ergoTrees.has(x.ergoTree));
  const ownOutputs = transaction.outputs.filter((x) => ergoTrees.has(x.ergoTree));

  const summary = {
    transactionId: transaction.transactionId,
    timestamp: transaction.timestamp,
    fee: new BigNumber(transaction.outputs.find((x) => x.ergoTree === FEE_CONTRACT)?.value ?? 0),
    delta: mapDelta(utxoDiff(ownOutputs, ownInputs)),
    confirmed: transaction.confirmed,
    height: "height" in transaction ? transaction.height : undefined
  };

  return transaction.confirmed
    ? (summary as ConfirmedTransactionSummary)
    : ({ ...summary, transaction } as UnconfirmedTransactionSummary);
}

function mapDelta(utxoSummary: BoxSummary): TokenAmount<BigNumber>[] {
  const tokens = utxoSummary.tokens.map((x) => ({
    tokenId: x.tokenId,
    amount: bn(x.amount.toString())
  }));

  return [
    {
      tokenId: ERG_TOKEN_ID,
      amount: bn(utxoSummary.nanoErgs.toString())
    },
    ...tokens
  ];
}
</script>

<template>
  <div class="flex flex-col gap-4">tx history {{ history }}</div>
</template>
