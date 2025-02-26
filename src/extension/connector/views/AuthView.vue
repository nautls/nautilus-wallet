<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useVuelidate } from "@vuelidate/core";
import { helpers, requiredUnless } from "@vuelidate/validators";
import { useEventListener } from "@vueuse/core";
import { AlertCircleIcon } from "lucide-vue-next";
import { useWalletStore } from "@/stores/walletStore";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormField } from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { signAuthMessage } from "@/chains/ergo/signing";
import { PasswordError } from "@/common/errors";
import { connectedDAppsDbService } from "@/database/connectedDAppsDbService";
import DappPlateHeader from "@/extension/connector/components/DappPlateHeader.vue";
import { AsyncRequest } from "@/extension/connector/rpc/asyncRequestQueue";
import { error, InternalRequest, success } from "@/extension/connector/rpc/protocol";
import { queue } from "@/extension/connector/rpc/uiRpcHandlers";
import { APIErrorCode, SignErrorCode } from "@/types/connector";
import type { AuthArgs } from "@/types/d.ts/webext-rpc";
import { WalletType } from "@/types/internal";

const app = useWalletStore();
const wallet = useWalletStore();
const { toast } = useToast();

const request = ref<AsyncRequest<AuthArgs>>();
const password = ref("");
const walletId = ref(0);

const isReadonly = computed(() => wallet.type === WalletType.ReadOnly);
const isLedger = computed(() => wallet.type === WalletType.Ledger);

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
      toast({
        title: "Wrong password!",
        variant: "destructive",
        description: "Please enter the correct spending password to authenticate."
      });
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
  <DappPlateHeader :favicon="request?.favicon" :origin="request?.origin">
    requests a proof that the selected address belongs to you
  </DappPlateHeader>

  <div class="grow"></div>

  <Card>
    <CardHeader>
      <CardTitle>Selected address</CardTitle>
    </CardHeader>

    <CardContent class="break-all">{{ request?.data.address }}</CardContent>
  </Card>

  <div class="grow"></div>

  <div class="flex flex-col gap-4">
    <Alert v-if="isReadonly || isLedger" variant="destructive" class="space-x-2">
      <AlertCircleIcon class="size-5" />
      <AlertTitle v-if="isReadonly">Read-only wallet</AlertTitle>
      <AlertTitle v-else-if="isLedger">Ledger wallet</AlertTitle>
      <AlertDescription>This wallet can't sign data.</AlertDescription>
    </Alert>

    <Form v-else @submit="authenticate">
      <FormField :validation="$v.password">
        <PasswordInput
          v-model="password"
          placeholder="Spending password"
          type="password"
          @blur="$v.password.$touch"
        />
      </FormField>
    </Form>

    <div class="flex flex-row gap-4">
      <Button class="w-full" variant="outline" @click="cancel">Cancel</Button>
      <Button class="w-full" :disabled="isReadonly || isLedger" @click="authenticate">
        Authenticate
      </Button>
    </div>
  </div>
</template>
