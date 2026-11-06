<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRegle } from "@regle/core";
import { required, withMessage } from "@regle/rules";
import { Loader2Icon } from "@lucide/vue";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { MnemonicBackupDialog } from "@/components/wallet";
import { log } from "@/common/logger";
import { extractErrorMessage } from "@/common/utils";
import { useProgrammaticDialog } from "@/composables/useProgrammaticDialog";
import { usePasswordKind } from "@/composables/usePasswordPrompt";
import PasswordDialog from "../PasswordDialog.vue";
import ExportPublicKeyDialog from "./ExportPublicKeyDialog.vue";

const wallet = useWalletStore();
const app = useAppStore();
const { t } = useI18n();
const { toast } = useToast();

const { kind: passwordKind, reload: reloadPasswordKind } = usePasswordKind(() => wallet.id);

const { open: openPublicKeyDialog } = useProgrammaticDialog(ExportPublicKeyDialog);
const { open: openPasswordDialog } = useProgrammaticDialog(PasswordDialog, {
  action: "change",
  onDone: reloadPasswordKind
});
const { open: openMnemonicBackupDialog } = useProgrammaticDialog(MnemonicBackupDialog);

const isStandard = computed(() => wallet.type === "standard");

function switchPassword(kind: unknown) {
  if (kind === passwordKind.value) return;
  openPasswordDialog({ action: kind === "master" ? "toMaster" : "toOwn" });
}

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

const removeConfirmation = ref("");
const canRemove = computed(() => removeConfirmation.value.trim() === wallet.name.trim());

function resetRemoveConfirmation(open: boolean) {
  if (open) removeConfirmation.value = "";
}

const resyncing = ref(false);

async function resync() {
  try {
    resyncing.value = true;
    await wallet.resync();
    toast({ title: t("settings.wallet.resyncDone") });
  } catch (e) {
    log.error(e);
    toast({
      title: t("settings.wallet.resyncFailed"),
      variant: "destructive",
      description: extractErrorMessage(e)
    });
  } finally {
    resyncing.value = false;
  }
}

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

    <Card v-if="isStandard && passwordKind" class="flex flex-col gap-4 p-6">
      <Label class="flex flex-col items-start gap-1"
        >{{ t("wallet.spendingPassword") }}
        <div class="text-muted-foreground text-xs font-normal hyphens-auto">
          {{ t("settings.wallet.spendingPasswordDesc") }}
        </div></Label
      >
      <Tabs
        :model-value="passwordKind"
        activation-mode="manual"
        @update:model-value="switchPassword"
      >
        <TabsList class="flex h-auto w-full">
          <TabsTrigger value="master" class="min-w-0 flex-1 basis-0 py-1.5">{{
            t("settings.password.master")
          }}</TabsTrigger>
          <TabsTrigger value="password" class="min-w-0 flex-1 basis-0 py-1.5">{{
            t("settings.password.own")
          }}</TabsTrigger>
        </TabsList>
      </Tabs>
      <Button
        v-if="passwordKind === 'password'"
        variant="outline"
        class="w-full"
        @click="openPasswordDialog({ action: 'change' })"
        >{{ t("settings.password.changePassword") }}</Button
      >
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
          >{{ t("wallet.backup.title") }}
          <div class="text-muted-foreground text-xs font-normal hyphens-auto">
            {{ t("settings.wallet.mnemonicBackupDesc") }}
          </div></Label
        >
        <Button variant="outline" class="w-full" @click="openMnemonicBackupDialog">{{
          t("common.backup")
        }}</Button>
      </div>

      <div class="col-span-2 grid grid-cols-subgrid items-center">
        <Label class="flex flex-col items-start gap-1"
          >{{ t("settings.wallet.resync") }}
          <div class="text-muted-foreground text-xs font-normal hyphens-auto">
            {{ t("settings.wallet.resyncDesc") }}
          </div></Label
        >
        <Button
          variant="outline"
          class="relative w-full"
          :disabled="resyncing || wallet.loading"
          @click="resync"
        >
          <span :class="{ invisible: resyncing }">{{ t("common.resync") }}</span>
          <Loader2Icon v-if="resyncing" class="absolute inset-0 m-auto animate-spin" />
        </Button>
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
        <Drawer @update:open="resetRemoveConfirmation">
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
            <div class="flex flex-col gap-2">
              <Label for="remove-confirmation-input">{{
                t("settings.wallet.walletRemoveTypeName", { name: wallet.name })
              }}</Label>
              <Input
                id="remove-confirmation-input"
                v-model="removeConfirmation"
                autocomplete="off"
                spellcheck="false"
              />
            </div>
            <DrawerFooter class="flex-row gap-4">
              <DrawerClose as-child>
                <Button variant="outline" class="flex-1">{{ t("common.cancel") }}</Button>
              </DrawerClose>
              <DrawerClose as-child>
                <Button
                  variant="destructive"
                  class="flex-2"
                  :disabled="!canRemove"
                  @click="app.deleteWallet(wallet.id)"
                  >{{ t("common.remove") }}</Button
                >
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>
    </Card>
  </div>
</template>
