<script setup lang="ts">
import { queue } from "@/background/rpcHandler";
import { InternalRequest } from "@/background/messaging";
import { computed, ref } from "vue";
import store from "@/store";
import { ProverStateType, SignEip28MessageCommand, WalletType } from "@/types/internal";
import { ACTIONS } from "@/constants/store";
import { PasswordError } from "@/types/errors";
import { connectedDAppsDbService } from "@/api/database/connectedDAppsDbService";
import { error, success } from "@/background/messaging";
import { APIErrorCode, SignErrorCode } from "@/types/connector";
import { AuthRequest } from "../../background/asyncRequestQueue";
import { onMounted } from "vue";
import { AuthArgs } from "@/@types/webext-rpc";
import { watch } from "vue";
import useVuelidate from "@vuelidate/core";
import { helpers, requiredUnless } from "@vuelidate/validators";
import SignStateModal from "@/components/SignStateModal.vue";

const request = ref<AuthRequest<AuthArgs>>();
const password = ref("");
const errorMessage = ref("");
const walletId = ref(0);

const isReadonly = computed(() => store.state.currentWallet.type === WalletType.ReadOnly);
const isLedger = computed(() => store.state.currentWallet.type === WalletType.Ledger);
const signState = computed(() => (errorMessage.value ? ProverStateType.error : undefined));

const $v = useVuelidate(
  {
    password: {
      required: helpers.withMessage(
        "A spending password is required for transaction signing.",
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
    request.value.resolve(error(APIErrorCode.Refused, "Not authorized."));
    window.close();
    return;
  }

  walletId.value = connection.walletId;
  window.addEventListener("beforeunload", refuse);
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
    const result = await store.dispatch(ACTIONS.SIGN_EIP28_MESSAGE, {
      address: request.value.data.address,
      message: request.value.data.address,
      origin: request.value.origin,
      walletId: walletId.value,
      password: password.value
    } as SignEip28MessageCommand);

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

function removeEventListener() {
  window.removeEventListener("beforeunload", refuse);
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
  <div class="flex flex-col h-full text-sm gap-4 pt-2">
    <h1 class="text-xl m-auto text-center pb-8">Authentication</h1>

    <dapp-plate :favicon="request?.favicon" :origin="request?.origin" />
    <p class="text-center">
      <span class="font-semibold">{{ request?.origin }}</span> wants to make sure the following
      address belongs to you.
    </p>
    <div
      class="text-left font-mono border-1 px-3 py-2 text-sm break-all rounded bg-gray-100 border-gray-300"
    >
      {{ request?.data.address }}
    </div>

    <div class="flex-grow"></div>

    <p v-if="isReadonly || isLedger" class="text-sm text-center">
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
