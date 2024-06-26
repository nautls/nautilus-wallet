<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useVuelidate } from "@vuelidate/core";
import { helpers, requiredUnless } from "@vuelidate/validators";
import { useEventListener } from "@vueuse/core";
import { queue } from "@/rpc/uiRpcHandlers";
import { error, InternalRequest, success } from "@/rpc/protocol";
import store from "@/store";
import { ProverStateType, WalletType } from "@/types/internal";
import { ACTIONS } from "@/constants/store";
import { PasswordError } from "@/common/errors";
import { connectedDAppsDbService } from "@/database/connectedDAppsDbService";
import { APIErrorCode, SignErrorCode } from "@/types/connector";
import { AsyncRequest } from "@/rpc/asyncRequestQueue";
import type { SignDataArgs } from "@/types/d.ts/webext-rpc";
import SignStateModal from "@/components/SignStateModal.vue";
import DappPlateHeader from "@/components/DappPlateHeader.vue";
import { signAuthMessage } from "@/chains/ergo/dataSigning";

const request = ref<AsyncRequest<SignDataArgs>>();
const password = ref("");
const errorMessage = ref("");
const walletId = ref(0);

const isReadonly = computed(() => store.state.currentWallet.type === WalletType.ReadOnly);
const isLedger = computed(() => store.state.currentWallet.type === WalletType.Ledger);
const signState = computed(() => (errorMessage.value ? ProverStateType.error : undefined));

const removeEventListener = useEventListener(window, "beforeunload", refuse);
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
  () => store.state.loading.wallets,
  (loading) => setWallet(loading, walletId.value),
  { immediate: true }
);

watch(
  () => walletId.value,
  (walletId) => setWallet(store.state.loading.wallets, walletId),
  { immediate: true }
);

function setWallet(loading: boolean, walletId: number) {
  if (loading || !walletId) return;
  store.dispatch(ACTIONS.SET_CURRENT_WALLET, walletId);
}

async function authenticate() {
  if (isReadonly.value || isLedger.value || !request.value) return;
  if (!(await $v.value.$validate())) return;

  try {
    const messageData = { message: request.value.data.message, origin: request.value.origin };
    const result = await signAuthMessage(messageData, {
      walletId: walletId.value,
      password: password.value,
      addresses: [request.value.data.address]
    });

    if (!request.value) return proverError("Prover returned undefined.");
    request.value.resolve(success(result));

    removeEventListener();
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
  removeEventListener();
  window.close();
}

function refuse() {
  if (!request.value) return;
  request.value.resolve(error(APIErrorCode.Refused, "User rejected."));
}
</script>

<template>
  <div class="flex flex-col h-full text-sm gap-2 pt-2">
    <dapp-plate-header :favicon="request?.favicon" :origin="request?.origin">
      requests a proof that the selected address belongs to you
    </dapp-plate-header>

    <div class="flex-grow"></div>

    <div class="flex shadow-sm flex-col border rounded">
      <div class="border-b-1 px-3 py-2 font-semibold rounded rounded-b-none">
        <div class="flex w-full">Selected address</div>
      </div>
      <div
        class="block bg-gray-700 rounded-b py-2 px-2 break-all max-h-64 overflow-y-auto font-mono text-white"
      >
        {{ request?.data.address }}
      </div>
    </div>

    <div class="flex-grow"></div>

    <p v-if="isReadonly || isLedger" class="text-sm text-center space-x-2">
      <vue-feather type="alert-triangle" class="text-yellow-500 align-middle" size="20" />
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
