<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useVuelidate } from "@vuelidate/core";
import { helpers, requiredUnless } from "@vuelidate/validators";
import { useEventListener } from "@vueuse/core";
import { TriangleAlertIcon } from "lucide-vue-next";
import { useWalletStore } from "@/stores/walletStore";
import DappPlateHeader from "@/components/DappPlateHeader.vue";
import SignStateModal from "@/components/SignStateModal.vue";
import { signAuthMessage } from "@/chains/ergo/signing";
import { PasswordError } from "@/common/errors";
import { connectedDAppsDbService } from "@/database/connectedDAppsDbService";
import { AsyncRequest } from "@/extension/connector/rpc/asyncRequestQueue";
import { error, InternalRequest, success } from "@/extension/connector/rpc/protocol";
import { queue } from "@/extension/connector/rpc/uiRpcHandlers";
import { APIErrorCode, SignErrorCode } from "@/types/connector";
import type { AuthArgs } from "@/types/d.ts/webext-rpc";
import { ProverStateType, WalletType } from "@/types/internal";

const app = useWalletStore();
const wallet = useWalletStore();

const request = ref<AsyncRequest<AuthArgs>>();
const password = ref("");
const errorMessage = ref("");
const walletId = ref(0);

const isReadonly = computed(() => wallet.type === WalletType.ReadOnly);
const isLedger = computed(() => wallet.type === WalletType.Ledger);
const signState = computed(() => (errorMessage.value ? ProverStateType.error : undefined));

const detachBeforeUnloadListener = useEventListener(window, "beforeunload", refuse);
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
  request.value = queue.pop(InternalRequest.Auth);
  if (!request.value) return;

  const connection = await connectedDAppsDbService.getByOrigin(request.value.origin);
  if (!connection || !connection.walletId) {
    request.value.resolve(error(APIErrorCode.Refused, "Unauthorized."));
    window.close();
    return;
  }

  walletId.value = connection.walletId;
});

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
    const messageData = { message: request.value.data.message, origin: request.value.origin };
    const result = await signAuthMessage(
      messageData,
      [request.value.data.address],
      walletId.value,
      password.value
    );

    if (!request.value) return proverError("Prover returned undefined.");
    request.value.resolve(success(result));

    detachBeforeUnloadListener();
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
  detachBeforeUnloadListener();
  window.close();
}

function refuse() {
  if (!request.value) return;
  request.value.resolve(error(APIErrorCode.Refused, "User rejected."));
}
</script>

<template>
  <div class="flex h-full flex-col gap-2 pt-2 text-sm">
    <dapp-plate-header :favicon="request?.favicon" :origin="request?.origin">
      requests a proof that the selected address belongs to you
    </dapp-plate-header>

    <div class="flex-grow"></div>

    <div class="flex flex-col rounded border shadow-sm">
      <div class="border-b-1 rounded rounded-b-none px-3 py-2 font-semibold">
        <div class="flex w-full">Selected address</div>
      </div>
      <div
        class="block max-h-64 overflow-y-auto break-all rounded-b bg-gray-700 px-2 py-2 font-mono text-white"
      >
        {{ request?.data.address }}
      </div>
    </div>

    <div class="flex-grow"></div>

    <p v-if="isReadonly || isLedger" class="space-x-2 text-center text-sm">
      <triangle-alert-icon class="inline align-middle text-yellow-500" :size="20" />
      <span class="align-middle">This wallet cannot sign messages.</span>
    </p>
    <div v-else class="text-left">
      <form @submit.prevent="authenticate()">
        <input
          v-model.lazy="password"
          placeholder="Spending password"
          type="password"
          class="control block w-full"
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
        Authenticate
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
