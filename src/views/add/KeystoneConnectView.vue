<script setup lang="ts">
import { onMounted, ref } from "vue";
import { hex } from "@fleet-sdk/crypto";
import { Account, KeystoneSDK, UR } from "@keystonehq/keystone-sdk";
import { useVuelidate } from "@vuelidate/core";
import { helpers, required } from "@vuelidate/validators";
import { Loader2Icon } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import { useAppStore } from "@/stores/appStore.ts";
import { useWalletStore } from "@/stores/walletStore.ts";
import KeystoneQrReader from "@/components/KeystoneQrReader.vue";
import { Button } from "@/components/ui/button";
import { Form, FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import HdKey from "@/chains/ergo/hdKey.ts";
import { WalletType } from "@/types/internal.ts";

const app = useAppStore();
const wallet = useWalletStore();
const { t } = useI18n();

const walletName = ref("");
const scanning = ref(true);
const ergoAccount = ref<Account>();

onMounted(() => {
  app.viewTitle = t("wallet.index.connectKeystone");
});

const handleScan = (result: UR) => {
  const ur = result;
  scanning.value = false;
  try {
    const sdk = new KeystoneSDK();
    const account = sdk.parseMultiAccounts(ur);
    ergoAccount.value = account.keys[0];
    scanning.value = false;
  } catch (e) {
    console.error(e);
  }
};

const v$ = useVuelidate(
  { walletName: { required: helpers.withMessage(t("wallet.requiredWalletName"), required) } },
  { walletName }
);

async function add() {
  const valid = await v$.value.$validate();
  if (!valid) return;

  if (ergoAccount.value?.publicKey !== undefined) {
    const extendedPublicKey = hex.encode(
      HdKey.fromPublicKey(
        {
          publicKey: ergoAccount.value.publicKey,
          chainCode: ergoAccount.value.chainCode
        },
        "m/0"
      ).extendedPublicKey
    );
    const walletId = await app.putWallet({
      type: WalletType.Keystone,
      name: walletName.value,
      extendedPublicKey: extendedPublicKey
    });
    await wallet.load(walletId, { syncInBackground: false });
  }
}
</script>

<template>
  <div class="flex h-full flex-col justify-between gap-4 p-4">
    <Form class="flex flex-col justify-start gap-4 pt-4" @submit="add">
      <FormField :validation="v$.walletName">
        <Label for="wallet-name">{{ t("wallet.walletName") }}</Label>
        <Input
          id="wallet-name"
          v-model="walletName"
          :disabled="scanning"
          maxlength="50"
          type="text"
          @blur="v$.walletName.$touch()"
        />
      </FormField>
    </Form>

    <keystone-qr-reader v-if="scanning" :handle-scan="handleScan" />
    <div
      v-if="!scanning"
      class="border-input bg-accent text-accent-foreground ring-offset-background flex w-full items-center justify-start gap-1 rounded-sm border px-1.5 py-2 text-start text-sm text-[0.84rem] wrap-anywhere shadow-xs"
    >
      <span>{{ ergoAccount?.extendedPublicKey }}</span>
    </div>

    <Button :disabled="scanning" type="button" class="w-full" @click="add">
      <template v-if="scanning">
        <Loader2Icon class="animate-spin" />
        {{ t("device.connecting") }}
      </template>
      <template v-else>{{ t("common.import") }}</template>
    </Button>
  </div>
</template>
