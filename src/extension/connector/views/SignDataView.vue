<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useVuelidate } from "@vuelidate/core";
import { helpers, requiredUnless } from "@vuelidate/validators";
import { useEventListener } from "@vueuse/core";
import { ErgoMessage, MessageType } from "@fleet-sdk/core";
import { hex } from "@fleet-sdk/crypto";
import VueJsonPretty from "vue-json-pretty";
import type { JsonObject } from "type-fest";
import { TriangleAlertIcon } from "lucide-vue-next";
import { queue } from "@/extension/connector/rpc/uiRpcHandlers";
import { error, InternalRequest, success } from "@/extension/connector/rpc/protocol";
import { ProverStateType, WalletType } from "@/types/internal";
import { PasswordError } from "@/common/errors";
import { connectedDAppsDbService } from "@/database/connectedDAppsDbService";
import { APIErrorCode, SignErrorCode } from "@/types/connector";
import { AsyncRequest } from "@/extension/connector/rpc/asyncRequestQueue";
import type { SignDataArgs } from "@/types/d.ts/webext-rpc";
import SignStateModal from "@/components/SignStateModal.vue";
import { signMessage } from "@/chains/ergo/signing";
import DappPlateHeader from "@/components/DappPlateHeader.vue";
import { useWalletStore } from "@/stores/walletStore";
import { useAppStore } from "@/stores/appStore";

import "vue-json-pretty/lib/styles.css";

const app = useAppStore();
const wallet = useWalletStore();

const request = ref<AsyncRequest<SignDataArgs>>();
const password = ref("");
const errorMessage = ref("");
const walletId = ref(0);
const messageData = ref<string | JsonObject>();
const messageType = ref<string>();
const encodedMessage = ref<string>();
let ergoMessage: ErgoMessage;

const isReadonly = computed(() => wallet.type === WalletType.ReadOnly);
const isLedger = computed(() => wallet.type === WalletType.Ledger);
const signState = computed(() => (errorMessage.value ? ProverStateType.error : undefined));

const detachUnloadListener = useEventListener(window, "beforeunload", refuse);

const $v = useVuelidate(
  {
    password: {
      required: helpers.withMessage(
        "A spending password is required for data signing.",
        requiredUnless(isLedger.value)
      )
    }
  },
  { password },
  { $lazy: true }
);

onMounted(async () => {
  const req = queue.pop(InternalRequest.SignData);
  if (!req) return;

  const connection = await connectedDAppsDbService.getByOrigin(req.origin);
  if (!connection || !connection.walletId) {
    req.resolve(error(APIErrorCode.Refused, "Unauthorized."));
    window.close();
    return;
  }

  request.value = req;
  walletId.value = connection.walletId;

  ergoMessage = ErgoMessage.fromData(req.data.message);
  messageData.value = decodeMessageData(ergoMessage);
  messageType.value = decodeMessageType(ergoMessage);
  encodedMessage.value = ergoMessage.encode();
});

function decodeMessageData(message: ErgoMessage) {
  const data = message.getData();

  if (!data) return "";
  if (message.type === MessageType.String) return data as string;
  if (message.type === MessageType.Json) return data as JsonObject;
  return hex.encode(data as Uint8Array);
}

function decodeMessageType(message: ErgoMessage) {
  switch (message.type) {
    case MessageType.String:
      return "Text";
    case MessageType.Json:
      return "JSON";
    case MessageType.Hash:
      return "Hash";
    default:
    case MessageType.Binary:
      return "Binary";
  }
}

watch(
  () => app.loading,
  (loading) => setWallet(loading, walletId.value),
  { immediate: true }
);

watch(
  () => walletId.value,
  (walletId) => setWallet(app.loading, walletId),
  { immediate: true }
);

function setWallet(loading: boolean, walletId: number) {
  if (loading || !walletId) return;
  wallet.load(walletId);
}

async function authenticate() {
  if (isReadonly.value || isLedger.value || !request.value) return;
  if (!(await $v.value.$validate())) return;

  try {
    const proof = await signMessage(
      ergoMessage,
      [request.value.data.address],
      walletId.value,
      password.value
    );

    if (!request.value) return proverError("Prover returned undefined.");
    request.value.resolve(success(proof));

    detachUnloadListener();
    window.close();
  } catch (e) {
    if (e instanceof PasswordError) {
      errorMessage.value = e.message;
    } else {
      request.value.resolve(proverError(typeof e === "string" ? e : (e as Error).message));
    }
  }
}

function proverError(message: string) {
  return error(SignErrorCode.ProofGeneration, message);
}

function cancel() {
  refuse();
  detachUnloadListener();
  window.close();
}

function refuse() {
  if (!request.value) return;
  request.value.resolve(error(APIErrorCode.Refused, "User rejected."));
}
</script>

<template>
  <div class="flex flex-col h-full text-sm gap-2 pt-2">
    <dapp-plate-header :favicon="request?.favicon" :origin="request?.origin"
      >requests to sign a message
    </dapp-plate-header>

    <div class="flex-grow"></div>

    <div class="flex shadow-sm flex-col border rounded">
      <div class="border-b-1 px-3 py-2 font-semibold rounded rounded-b-none">
        <div class="flex w-full">{{ messageType }} message</div>
        <div class="text-xs font-normal pt-1 break-all">{{ encodedMessage }}</div>
      </div>
      <template v-if="messageData">
        <div
          v-if="typeof messageData === 'string'"
          class="block bg-gray-700 rounded-b py-2 px-2 break-all max-h-64 overflow-y-auto font-mono text-xs text-white"
        >
          {{ messageData }}
        </div>
        <div v-else class="block bg-gray-700 rounded-b py-2 px-2 max-h-64 overflow-y-auto">
          <vue-json-pretty
            class="!font-mono !text-xs text-white"
            :highlight-selected-node="false"
            :show-double-quotes="true"
            :show-length="true"
            :show-line="false"
            :deep="3"
            :data="messageData"
          ></vue-json-pretty>
        </div>
      </template>
    </div>

    <div class="flex-grow"></div>

    <p v-if="isReadonly || isLedger" class="text-sm text-center space-x-2">
      <triangle-alert-icon class="text-yellow-500 align-middle inline" :size="20" />
      <span class="align-middle">This wallet cannot sign messages.</span>
    </p>
    <div v-else class="text-left">
      <form @submit.prevent="authenticate()">
        <input
          v-model.lazy="password"
          placeholder="Spending password"
          type="password"
          class="w-full control block"
          @blur="$v.password.$touch()"
        />
        <p v-if="$v.password.$error" class="input-error">
          {{ $v.password.$errors[0].$message }}
        </p>
      </form>
    </div>

    <div class="flex flex-row gap-4">
      <button class="btn outlined w-full" @click="cancel()">Cancel</button>
      <button class="btn w-full" :disabled="isReadonly || isLedger" @click="authenticate()">
        Sign
      </button>
    </div>

    <sign-state-modal
      title="Signing"
      :caption="errorMessage"
      :state="signState"
      @close="errorMessage = ''"
    />
  </div>
</template>
