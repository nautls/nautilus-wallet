<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { ErgoMessage, MessageType } from "@fleet-sdk/core";
import { hex } from "@fleet-sdk/crypto";
import { useVuelidate } from "@vuelidate/core";
import { helpers, requiredUnless } from "@vuelidate/validators";
import { useEventListener } from "@vueuse/core";
import { AlertCircleIcon } from "lucide-vue-next";
import type { JsonObject } from "type-fest";
import { useI18n } from "vue-i18n";
import { useAppStore } from "@/stores/appStore";
import { useWalletStore } from "@/stores/walletStore";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormField } from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/input";
import { JsonViewer } from "@/components/ui/json-viewer";
import { useToast } from "@/components/ui/toast";
import { signMessage } from "@/chains/ergo/signing";
import { PasswordError } from "@/common/errors";
import { connectedDAppsDbService } from "@/database/connectedDAppsDbService";
import RequestHeader from "@/extension/connector/components/RequestHeader.vue";
import { AsyncRequest } from "@/extension/connector/rpc/asyncRequestQueue";
import { error, InternalRequest, success } from "@/extension/connector/rpc/protocol";
import { queue } from "@/extension/connector/rpc/uiRpcHandlers";
import { APIErrorCode, SignErrorCode } from "@/types/connector";
import type { SignDataArgs } from "@/types/d.ts/webext-rpc";
import { WalletType } from "@/types/internal";

const app = useAppStore();
const wallet = useWalletStore();
const { toast } = useToast();
const { t } = useI18n();

const request = ref<AsyncRequest<SignDataArgs>>();
const password = ref("");
const walletId = ref(0);
const messageData = ref<string | JsonObject>();
const messageType = ref<string>();
const encodedMessage = ref<string>();
let ergoMessage: ErgoMessage;

const isReadonly = computed(() => wallet.type === WalletType.ReadOnly);
const isLedger = computed(() => wallet.type === WalletType.Ledger);

const detachUnloadListener = useEventListener(window, "beforeunload", refuse);

const $v = useVuelidate(
  {
    password: {
      required: helpers.withMessage(
        t("wallet.requiredSpendingPassword"),
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
      return t("connector.signData.dataType.text");
    case MessageType.Json:
      return t("connector.signData.dataType.json");
    case MessageType.Hash:
      return t("connector.signData.dataType.hash");
    case MessageType.Binary:
    default:
      return t("connector.signData.dataType.binary");
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

async function sign() {
  if (isReadonly.value || isLedger.value || !request.value) return;
  if (!(await $v.value.$validate())) return;

  try {
    const proof = await signMessage(
      ergoMessage,
      [request.value.data.address],
      walletId.value,
      password.value
    );

    if (!request.value) return proverError(t("wallet.emptyProof"));
    request.value.resolve(success(proof));

    detachUnloadListener();
    window.close();
  } catch (e) {
    if (e instanceof PasswordError) {
      toast({
        title: t("wallet.wrongPassword"),
        variant: "destructive",
        description: t("wallet.wrongPasswordDesc")
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
  detachUnloadListener();
  window.close();
}

function refuse() {
  if (!request.value) return;
  request.value.resolve(error(APIErrorCode.Refused, "User rejected."));
}
</script>

<template>
  <div class="flex h-full flex-col justify-between gap-4">
    <RequestHeader
      i18n-keypath="connector.signData.header"
      :favicon="request?.favicon"
      :origin="request?.origin"
    />

    <Card>
      <CardHeader>
        <CardTitle>{{ messageType }}</CardTitle>
        <CardDescription class="text-xs break-all">{{ encodedMessage }}</CardDescription>
      </CardHeader>

      <CardContent class="flex flex-col">
        <div
          v-if="typeof messageData === 'string'"
          class="-mx-2 max-h-[225px] overflow-y-auto px-2 font-mono text-xs break-all"
        >
          {{ messageData }}
        </div>

        <JsonViewer
          v-else
          :deep="3"
          :data="messageData"
          class="-mx-2 h-full max-h-[225px] overflow-y-auto"
        />
      </CardContent>
    </Card>

    <div class="flex flex-col gap-4">
      <Alert v-if="isReadonly || isLedger" variant="destructive" class="space-x-2">
        <AlertCircleIcon class="size-5" />
        <AlertTitle v-if="isReadonly">{{ t("wallet.readonlyWallet") }}</AlertTitle>
        <AlertTitle v-else-if="isLedger">{{ t("wallet.ledgerWallet") }}</AlertTitle>
        <AlertDescription>{{ t("wallet.cantSignData") }}</AlertDescription>
      </Alert>

      <Form v-else @submit="sign">
        <FormField :validation="$v.password">
          <PasswordInput
            v-model="password"
            :placeholder="t('wallet.spendingPassword')"
            type="password"
            @blur="$v.password.$touch"
          />
        </FormField>
      </Form>

      <div class="flex flex-row gap-4">
        <Button class="w-full" variant="outline" @click="cancel">{{ t("common.cancel") }}</Button>
        <Button class="w-full" :disabled="isReadonly || isLedger" @click="sign">{{
          t("common.sign")
        }}</Button>
      </div>
    </div>
  </div>
</template>
