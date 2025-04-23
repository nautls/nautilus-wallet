<script setup lang="ts">
import { ref, watch } from "vue";
import { useVuelidate } from "@vuelidate/core";
import { helpers, required } from "@vuelidate/validators";
import { useI18n } from "vue-i18n";
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
const { t } = useI18n();

const { open: openPublicKeyDialog } = useProgrammaticDialog(ExportPublicKeyDialog);

const walletName = ref(wallet.name);

watch(walletName, (newName) => {
  if (v$.value.walletName.$error) return;
  wallet.name = newName;
});

const v$ = useVuelidate(
  { walletName: { required: helpers.withMessage(t("wallet.requiredWalletName"), required) } },
  { walletName },
  { $autoDirty: true }
);
</script>

<template>
  <div class="space-y-4">
    <Card class="flex flex-col gap-4 p-6">
      <FormField :validation="v$.walletName">
        <Label for="name-input">{{ t("wallet.walletName") }}</Label>
        <Input id="name-input" v-model="walletName" />
        <template #description>{{ t("settings.wallet.walletNameDesc") }}</template>
      </FormField>

      <div class="flex items-center justify-between gap-4">
        <Label for="address-reuse" class="flex flex-col gap-1">
          {{ t("settings.wallet.avoidAddressReuse") }}
          <div class="text-muted-foreground text-xs font-normal hyphens-auto">
            {{ t("settings.wallet.avoidAddressReuseDesc") }}
          </div>
        </Label>
        <Switch id="address-reuse" v-model="wallet.settings.avoidAddressReuse" />
      </div>
    </Card>

    <Card class="flex flex-col gap-4 p-6">
      <div class="flex items-center justify-between gap-4">
        <Label class="flex flex-col gap-1"
          >{{ t("wallet.xPubKey") }}
          <div class="text-muted-foreground text-xs font-normal hyphens-auto">
            {{ t("settings.wallet.xPubKeyDesc") }}
          </div></Label
        >
        <Button variant="outline" @click="openPublicKeyDialog">{{ t("common.export") }}</Button>
      </div>
    </Card>

    <Card class="bg-destructive/15 flex flex-col gap-4 p-6">
      <div class="flex items-center justify-between gap-4">
        <Label class="flex flex-col gap-1">
          {{ t("settings.wallet.removeWallet") }}
          <div class="text-muted-foreground text-xs font-normal hyphens-auto">
            {{ t("settings.wallet.removeWalletDesc") }}
          </div>
        </Label>
        <Drawer>
          <DrawerTrigger as-child>
            <Button variant="destructive">{{ t("common.remove") }}</Button>
          </DrawerTrigger>

          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle v-once>{{ t("settings.wallet.walletRemoveConfirmation") }}</DrawerTitle>
            </DrawerHeader>
            <div v-once>
              {{ t("settings.wallet.walletRemoveConfirmationDesc") }}
            </div>
            <DrawerFooter>
              <DrawerClose>
                <Button variant="outline" class="w-full">{{ t("common.cancel") }}</Button>
              </DrawerClose>
              <DrawerClose>
                <Button variant="destructive" class="w-full" @click="app.deleteWallet(wallet.id)">{{
                  t("common.remove")
                }}</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>
    </Card>
  </div>
</template>
