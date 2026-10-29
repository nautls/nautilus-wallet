<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRegle } from "@regle/core";
import { required, withMessage } from "@regle/rules";
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
import { MnemonicBackupDialog } from "@/components/wallet";
import { useProgrammaticDialog } from "@/composables/useProgrammaticDialog";
import ChangePasswordDialog from "./ChangePasswordDialog.vue";
import ExportPublicKeyDialog from "./ExportPublicKeyDialog.vue";

const wallet = useWalletStore();
const app = useAppStore();
const { t } = useI18n();

const { open: openPublicKeyDialog } = useProgrammaticDialog(ExportPublicKeyDialog);
const { open: openChangePasswordDialog } = useProgrammaticDialog(ChangePasswordDialog);
const { open: openMnemonicBackupDialog } = useProgrammaticDialog(MnemonicBackupDialog);

const isStandard = computed(() => wallet.type === "standard");

const walletName = ref(wallet.name);

watch(walletName, (newName) => {
  if (!r$.walletName.$validateSync()) return;
  wallet.name = newName;
});

// reflect renames made by other windows
watch(
  () => wallet.name,
  (name) => {
    if (name !== walletName.value) walletName.value = name;
  }
);

const { r$ } = useRegle(
  { walletName },
  { walletName: { required: withMessage(required, () => t("wallet.requiredWalletName")) } }
);
</script>

<template>
  <div class="space-y-4">
    <Card class="flex flex-col gap-4 p-6">
      <FormField :validation="r$.walletName">
        <Label for="name-input">{{ t("wallet.walletName") }}</Label>
        <Input id="name-input" v-model="walletName" />
        <template #description>{{ t("settings.wallet.walletNameDesc") }}</template>
      </FormField>

      <div class="flex items-center justify-between gap-4">
        <Label for="address-reuse" class="flex flex-col items-start gap-1">
          {{ t("settings.wallet.avoidAddressReuse") }}
          <div class="text-muted-foreground text-xs font-normal hyphens-auto">
            {{ t("settings.wallet.avoidAddressReuseDesc") }}
          </div>
        </Label>
        <Switch id="address-reuse" v-model="wallet.settings.avoidAddressReuse" />
      </div>
    </Card>

    <Card class="grid grid-cols-[1fr_auto] gap-4 p-6">
      <div class="col-span-2 grid grid-cols-subgrid items-center">
        <Label class="flex flex-col items-start gap-1"
          >{{ t("wallet.xPubKey") }}
          <div class="text-muted-foreground text-xs font-normal hyphens-auto">
            {{ t("settings.wallet.xPubKeyDesc") }}
          </div></Label
        >
        <Button variant="outline" class="w-full" @click="openPublicKeyDialog">{{
          t("common.export")
        }}</Button>
      </div>

      <div v-if="isStandard" class="col-span-2 grid grid-cols-subgrid items-center">
        <Label class="flex flex-col items-start gap-1"
          >{{ t("wallet.spendingPassword") }}
          <div class="text-muted-foreground text-xs font-normal hyphens-auto">
            {{ t("settings.wallet.spendingPasswordDesc") }}
          </div></Label
        >
        <Button variant="outline" class="w-full" @click="openChangePasswordDialog">{{
          t("common.change")
        }}</Button>
      </div>

      <div v-if="isStandard" class="col-span-2 grid grid-cols-subgrid items-center">
        <Label class="flex flex-col items-start gap-1"
          >{{ t("wallet.backup.title") }}
          <div class="text-muted-foreground text-xs font-normal hyphens-auto">
            {{ t("settings.wallet.mnemonicBackupDesc") }}
          </div></Label
        >
        <Button variant="outline" class="w-full" @click="openMnemonicBackupDialog">{{
          t("common.backup")
        }}</Button>
      </div>
    </Card>

    <Card class="bg-destructive/15 flex flex-col gap-4 p-6">
      <div class="flex items-center justify-between gap-4">
        <Label class="flex flex-col items-start gap-1">
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
            <DrawerFooter class="flex-row gap-4">
              <DrawerClose as-child>
                <Button variant="outline" class="flex-1">{{ t("common.cancel") }}</Button>
              </DrawerClose>
              <DrawerClose as-child>
                <Button variant="destructive" class="flex-2" @click="app.deleteWallet(wallet.id)">{{
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
