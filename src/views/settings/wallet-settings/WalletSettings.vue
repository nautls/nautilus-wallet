<script setup lang="ts">
import { ref, watch } from "vue";
import { useVuelidate } from "@vuelidate/core";
import { helpers, required } from "@vuelidate/validators";
import { useWalletStore } from "@/stores/walletStore";
import FormField from "@/components/FormField.vue";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useProgrammaticDialog } from "@/composables/useProgrammaticDialog";
import ExportPublicKeyDialog from "./ExportPublicKeyDialog.vue";

const wallet = useWalletStore();
const { open: openPublicKeyDialog } = useProgrammaticDialog(ExportPublicKeyDialog);

const walletName = ref(wallet.name);

watch(walletName, (newName) => {
  if (v$.value.walletName.$error) return;
  wallet.name = newName;
});

const v$ = useVuelidate(
  { walletName: { required: helpers.withMessage("Wallet name is required.", required) } },
  { walletName },
  { $autoDirty: true }
);
</script>

<template>
  <div class="space-y-6">
    <Card class="flex flex-col gap-6 p-6">
      <div class="flex flex-col gap-2">
        <FormField :validation="v$.walletName">
          <Label for="name-input">Wallet Name</Label>
          <Input id="name-input" v-model="walletName" />
          <template #description> Set the internal wallet name.</template>
        </FormField>
      </div>

      <div class="flex items-center justify-between gap-2">
        <Label for="address-reuse" class="flex flex-col gap-1"
          >Avoid Address Reuse
          <div class="text-muted-foreground text-xs">
            Enable this option to avoid reusing the same address for multiple transactions.
          </div></Label
        >
        <Switch id="address-reuse" v-model:checked="wallet.settings.avoidAddressReuse" />
      </div>
    </Card>

    <Card class="flex flex-col gap-6 p-6">
      <div class="flex items-center justify-between gap-2">
        <Label class="flex flex-col gap-2"
          >Public Key
          <div class="text-muted-foreground text-xs">
            Use this option to export your public key.
          </div></Label
        >
        <Button variant="outline" @click="openPublicKeyDialog">Export</Button>
      </div>
    </Card>

    <Card class="flex flex-col gap-6 p-6 bg-red-500/10">
      <div class="flex items-center justify-between gap-2">
        <Label class="flex flex-col gap-2"
          >Remove Wallet
          <div class="text-muted-foreground text-xs">
            Removing a wallet won't affect its blockchain balance, and you can restore it later.
            However, ensure you still have the details needed for restoration. Without them,
            removing the wallet can lead to irreversible loss of funds.
          </div></Label
        >
        <Button variant="destructive">Remove</Button>
      </div>
    </Card>
  </div>
</template>
