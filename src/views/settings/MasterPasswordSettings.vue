<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger
} from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { log } from "@/common/logger";
import { extractErrorMessage } from "@/common/utils";
import { useProgrammaticDialog } from "@/composables/useProgrammaticDialog";
import { walletsDbService } from "@/database/walletsDbService";
import PasswordDialog from "./PasswordDialog.vue";

const { t } = useI18n();
const { toast } = useToast();

const hasMaster = ref<boolean>();
const usage = ref({ used: 0, total: 0 });

const { open: openPasswordDialog } = useProgrammaticDialog(PasswordDialog, {
  action: "setUpMaster",
  onDone: load
});

onMounted(load);

async function load() {
  [hasMaster.value, usage.value] = await Promise.all([
    walletsDbService.hasMasterPassword(),
    walletsDbService.getMasterPasswordUsage()
  ]);
}

const canReset = computed(() => hasMaster.value === true && usage.value.used === 0);

const description = computed(() => {
  if (!hasMaster.value) return t("settings.password.masterNotSetUp");
  if (usage.value.used === 0) return t("settings.password.masterUnused");
  return t("settings.password.masterUsage", usage.value, usage.value.total);
});

async function reset() {
  try {
    await walletsDbService.resetMasterPassword();
    toast({ title: t("settings.password.masterReset") });
    openPasswordDialog({ action: "setUpMaster" });
  } catch (e) {
    log.error(e);
    toast({
      title: t("settings.password.masterResetFailed"),
      variant: "destructive",
      description: extractErrorMessage(e)
    });
  } finally {
    await load();
  }
}
</script>

<template>
  <Card class="flex flex-col gap-4 p-6" data-master-password-settings>
    <div class="flex items-center justify-between gap-4">
      <Label class="flex flex-col items-start gap-1">
        {{ t("wallet.masterPassword") }}
        <div class="text-muted-foreground text-xs font-normal">
          {{ hasMaster === undefined ? "" : description }}
        </div>
      </Label>

      <template v-if="hasMaster !== undefined && !canReset">
        <Button
          v-if="hasMaster"
          variant="outline"
          @click="openPasswordDialog({ action: 'changeMaster' })"
          >{{ t("common.change") }}</Button
        >
        <Button v-else variant="outline" @click="openPasswordDialog({ action: 'setUpMaster' })">{{
          t("settings.password.setUp")
        }}</Button>
      </template>
    </div>

    <div v-if="canReset" class="flex gap-2">
      <Drawer>
        <DrawerTrigger as-child>
          <Button variant="outline" class="flex-1">{{ t("settings.password.reset") }}</Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{{ t("settings.password.resetMaster") }}</DrawerTitle>
            <DrawerDescription class="hyphens-auto">{{
              t("settings.password.resetMasterDesc")
            }}</DrawerDescription>
          </DrawerHeader>
          <DrawerFooter class="flex-row gap-4">
            <DrawerClose as-child>
              <Button class="flex-1" variant="outline">{{ t("common.cancel") }}</Button>
            </DrawerClose>
            <DrawerClose as-child>
              <Button class="flex-2" variant="destructive" @click="reset">{{
                t("settings.password.reset")
              }}</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Button
        variant="outline"
        class="flex-1"
        @click="openPasswordDialog({ action: 'changeMaster' })"
        >{{ t("common.change") }}</Button
      >
    </div>
  </Card>
</template>
