<script setup lang="ts">
import { computed, h, nextTick, ref, useTemplateRef } from "vue";
import {
  AddressType,
  EIP12UnsignedTransaction,
  SignedInput,
  SignedTransaction
} from "@fleet-sdk/common";
import { useVuelidate } from "@vuelidate/core";
import { helpers, requiredUnless } from "@vuelidate/validators";
import { DeviceError, RETURN_CODE } from "ledger-ergo-js";
import { AlertCircleIcon, Loader2Icon } from "lucide-vue-next";
import VueJsonPretty from "vue-json-pretty";
import { useAppStore } from "@/stores/appStore";
import { useAssetsStore } from "@/stores/assetsStore";
import { useWalletStore } from "@/stores/walletStore";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CopyButton } from "@/components/ui/copy-button";
import { Form, FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ToastAction, useToast } from "@/components/ui/toast";
import { graphQLService } from "@/chains/ergo/services/graphQlService";
import { signTransaction } from "@/chains/ergo/signing";
import { OutputInterpreter, TransactionInterpreter } from "@/chains/ergo/transaction/interpreter";
import { PasswordError } from "@/common/errors";
import { log } from "@/common/logger";
import { extractErrorMessage } from "@/common/utils";
import { useFormat } from "@/composables";
import { WalletType } from "@/types/internal";
import { TransactionEntry } from ".";
import LedgerDevice from "../LedgerDevice.vue";

import "vue-json-pretty/lib/styles.css";

interface Props {
  transaction?: EIP12UnsignedTransaction;
  inputsToSign?: number[];
  loading?: boolean;
  broadcast?: boolean;
}

interface Emits {
  (e: "success", payload: SignedTransaction | SignedInput[]): void;
  (e: "fail", payload: string): void;
  (e: "refused"): void;
}

const props = withDefaults(defineProps<Props>(), {
  broadcast: true,
  transaction: undefined,
  inputsToSign: undefined
});

const emit = defineEmits<Emits>();

const app = useAppStore();
const wallet = useWalletStore();
const assets = useAssetsStore();
const format = useFormat();

const { toast } = useToast();
const pwdInput = useTemplateRef("pwd-input");
const ledgerDevice = useTemplateRef("ledger-device");

const password = ref("");
const hasBurnAgreement = ref(false);
const signing = ref(false);

const isLedger = computed(() => wallet.type === WalletType.Ledger);
const isReadonly = computed(() => wallet.type === WalletType.ReadOnly);
const canSign = computed(
  () =>
    props.transaction &&
    !isReadonly.value && // Can't sign with read-only wallets
    (!parsedTx.value?.burning || (parsedTx.value?.burning && hasBurnAgreement.value)) // Must agree to burn, if burning
);

const parsedTx = computed((): TransactionInterpreter | undefined => {
  if (!wallet.addresses.length || !props.transaction) return;

  return new TransactionInterpreter(
    props.transaction,
    wallet.addresses.map((a) => a.script),
    assets.metadata
  );
});

function getOutputTitle(output: OutputInterpreter): string {
  if (output.isBabelSwap) {
    return "Babel Fee Swap";
  } else if (output.isReceiving) {
    return "Sending to Your Address";
  } else if (output.receiverAddressType === AddressType.P2S) {
    return "Sending to Contract";
  } else if (output.receiverAddressType === AddressType.P2SH) {
    return "Sending to Script Hash";
  }

  return "Sending to External Address";
}

function isP2S(output: OutputInterpreter): boolean {
  return output.receiverAddressType === AddressType.P2S;
}

async function sign() {
  if (!canSign.value || !props.transaction) return;

  const valid = await v$.value.$validate();
  if (!valid) return;

  try {
    signing.value = true;

    const ready = await ledgerDevice.value?.openErgoApp();
    if (!ready) return;

    const signed = await signTransaction({
      transaction: props.transaction,
      password: password.value,
      inputsToSign: props.inputsToSign,
      stateCallback: ledgerDevice.value?.setState
    });

    if (!signed) throw new Error("Prover returned no signed data.");

    if (props.broadcast && !Array.isArray(signed) /* only broadcast full transactions */) {
      const txId = await broadcastTransaction(signed);
      if (txId) emit("success", signed);
    } else {
      emit("success", signed);
    }

    // clear password after signing
    password.value = "";
    v$.value.$reset();
  } catch (e) {
    if (e instanceof PasswordError) {
      toast({
        title: "Wrong password!",
        variant: "destructive",
        description: "Please enter the correct spending password to sign this transaction."
      });
      nextTick(() => pwdInput.value?.$el.focus());

      return;
    } else if (e instanceof DeviceError) {
      if (e.code === RETURN_CODE.DENIED || e.code === RETURN_CODE.GLOBAL_ACTION_REFUSED) {
        emit("refused");
        return;
      } else if (
        e.code === RETURN_CODE.GLOBAL_LOCKED_DEVICE ||
        e.code === RETURN_CODE.GLOBAL_PIN_NOT_SET
      ) {
        ledgerDevice.value?.setState({ label: "Device is locked", type: "locked" });
        return;
      }
    }

    log.error(e);
    emit("fail", extractErrorMessage(e));
  } finally {
    signing.value = false;
  }
}

async function broadcastTransaction(signedTransaction: SignedTransaction, retry = false) {
  try {
    if (retry) signing.value = true;

    const result = await graphQLService.submitTransaction(signedTransaction, wallet.id);
    return result.transactionId;
  } catch (e) {
    toast({
      title: "Transaction broadcast failed",
      description: typeof e === "string" ? e : (e as Error).message,
      variant: "destructive",
      action: h(
        ToastAction,
        {
          onClick: () => broadcastTransaction(signedTransaction, true),
          altText: "Try again"
        },
        { default: () => "Try again" }
      )
    });
  } finally {
    if (retry) signing.value = false;
  }
}

const v$ = useVuelidate(
  computed(() => ({
    password: {
      required: helpers.withMessage(
        "Please enter your spending password.",
        requiredUnless(isLedger.value)
      )
    }
  })),
  { password }
);
</script>

<template>
  <ScrollArea type="hover" class="-mx-6 px-6 h-[100vh] border-y" hide-outline>
    <div class="flex flex-col gap-6 text-sm py-4">
      <template v-if="loading">
        <TransactionEntry v-for="i in 4" :key="i" loading :assets="[]" />
      </template>

      <template v-else-if="parsedTx">
        <TransactionEntry
          v-if="parsedTx.burning"
          :assets="parsedTx.burning"
          type="burn"
          variant="destructive"
        >
          <p>Burning</p>
          <template #subheader>
            <span class="text-destructive-foreground/80">
              The assets listed below will be lost. Only continue if you know exactly what are you
              doing.
            </span>
          </template>
        </TransactionEntry>

        <TransactionEntry
          v-if="parsedTx?.totalIncoming?.length"
          :assets="parsedTx.totalIncoming"
          type="positive"
        >
          Total assets <strong>incoming</strong> to your wallet
        </TransactionEntry>
        <TransactionEntry
          v-if="parsedTx?.totalLeaving?.length"
          :assets="parsedTx.totalLeaving"
          type="negative"
        >
          Total assets <strong>leaving</strong> your wallet
        </TransactionEntry>

        <Separator label="Transaction details" />

        <TransactionEntry
          v-for="(output, index) in parsedTx.sending"
          :key="index"
          :assets="output.assets"
          :type="output.isBabelSwap ? 'swap' : output.isReceiving ? 'positive' : 'negative'"
        >
          <p>
            {{ getOutputTitle(output) }}
          </p>
          <template v-if="!output.isBabelSwap" #subheader>
            <div class="flex flex-col gap-2 break-all font-mono">
              <p>
                {{ format.string.shorten(output.receiver, 60) }}
                <CopyButton
                  :content="output.receiver"
                  variant="minimal"
                  size="condensed"
                  class="size-2.5"
                />
              </p>
              <p v-if="isLedger && isP2S(output)">
                <span class="font-sans font-semibold">Script Hash:</span>
                {{ output.scriptHash }}
              </p>
            </div>
          </template>
        </TransactionEntry>

        <TransactionEntry v-if="parsedTx?.fee" :assets="parsedTx.fee.assets" type="negative">
          Network Fee
        </TransactionEntry>

        <div
          v-if="app.settings.devMode"
          class="rounded-xl bg-secondary text-secondary-foreground p-4 shadow"
        >
          <VueJsonPretty
            class="!font-mono !text-xs text-foreground"
            :highlight-selected-node="false"
            :show-double-quotes="true"
            :show-length="true"
            :show-line="false"
            :deep="1"
            :data="props.transaction"
          />
        </div>
      </template>
    </div>
  </ScrollArea>

  <div class="flex flex-col gap-4">
    <div v-if="parsedTx?.burning" class="flex items-center gap-2">
      <Checkbox id="burn" v-model:checked="hasBurnAgreement" />
      <label
        for="burn"
        class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      >
        Burn tokens permanently
      </label>
    </div>

    <Alert v-if="isReadonly" variant="destructive" class="space-x-2">
      <AlertCircleIcon class="size-5" />
      <AlertTitle>Read-only wallet</AlertTitle>
      <AlertDescription> This wallet can't sign transactions. </AlertDescription>
    </Alert>

    <LedgerDevice v-else-if="isLedger" ref="ledger-device" />

    <Form v-else @submit="sign">
      <FormField :validation="v$.password">
        <Input
          ref="pwd-input"
          v-model="password"
          placeholder="Spending password"
          type="password"
          :disabled="loading || signing || !canSign"
          class="w-full"
          @blur="v$.password.$touch()"
        />
      </FormField>
    </Form>

    <div class="flex flex-row gap-4">
      <Button
        class="w-full"
        variant="outline"
        :disabled="loading || signing"
        @click="emit('refused')"
        >Cancel</Button
      >
      <Button class="w-full" :disabled="loading || signing || !canSign" @click="sign">
        <Loader2Icon v-if="signing" class="animate-spin" />
        <template v-else>Sign</template>
      </Button>
    </div>
  </div>
</template>

<style>
.vjs-tree .vjs-tree-node,
.vjs-tree .vjs-tree__node {
  @apply -mx-4 px-4 py-0.5 text-xs;
}

.vjs-tree .vjs-tree-node:hover,
.vjs-tree .vjs-tree__node:hover {
  @apply bg-gray-500/10 dark:bg-gray-500/20;
}
</style>
