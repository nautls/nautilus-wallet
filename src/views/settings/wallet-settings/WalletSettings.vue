<script setup lang="ts">
import { ref, watch } from "vue";
import { useVuelidate } from "@vuelidate/core";
import { helpers, required } from "@vuelidate/validators";
import { useAppStore } from "@/stores/appStore";
import { useWalletStore } from "@/stores/walletStore";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger
} from "@/components/ui/drawer";
import { FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useProgrammaticDialog } from "@/composables/useProgrammaticDialog";
import ExportPublicKeyDialog from "./ExportPublicKeyDialog.vue";

const wallet = useWalletStore();
const app = useAppStore();

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
      <FormField :validation="v$.walletName">
        <Label for="name-input">Wallet Name</Label>
        <Input id="name-input" v-model="walletName" />
        <template #description>Set the internal wallet name.</template>
      </FormField>

      <div class="flex items-center justify-between gap-4">
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
      <div class="flex items-center justify-between gap-4">
        <Label class="flex flex-col gap-1"
          >Public Key
          <div class="text-muted-foreground text-xs">
            Use this option to export your public key.
          </div></Label
        >
        <Button variant="outline" @click="openPublicKeyDialog">Export</Button>
      </div>
    </Card>

    <Card class="bg-destructive/15 flex flex-col gap-6 p-6">
      <div class="flex items-center justify-between gap-4">
        <Label class="flex flex-col gap-1">
          Remove Wallet
          <div class="text-muted-foreground text-xs">
            Use this option to remove the current wallet.
          </div>
        </Label>
        <Drawer>
          <DrawerTrigger as-child>
            <Button variant="destructive">Remove</Button>
          </DrawerTrigger>

          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Are you absolutely sure?</DrawerTitle>
            </DrawerHeader>
            <div>
              Removing a wallet won't affect its blockchain balance, and you can restore it later.
              However, ensure you still have the details needed for restoration. Without them,
              removing the wallet can lead to irreversible loss of funds.
            </div>
            <DrawerFooter>
              <DrawerClose>
                <Button variant="outline" class="w-full">Cancel</Button>
              </DrawerClose>
              <DrawerClose>
                <Button variant="destructive" class="w-full" @click="app.deleteWallet(wallet.id)"
                  >Remove</Button
                >
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>
    </Card>
  </div>
</template>
