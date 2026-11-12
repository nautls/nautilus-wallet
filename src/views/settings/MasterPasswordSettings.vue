<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
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
import { useToast } from "@/components/ui/toast";
import { log } from "@/common/logger";
import { extractErrorMessage } from "@/common/utils";
import { useProgrammaticDialog } from "@/composables/useProgrammaticDialog";
import { walletsDbService } from "@/database/walletsDbService";
import PasswordDialog from "./PasswordDialog.vue";

const { t } = useI18n();
const router = useRouter();
const { toast } = useToast();

const hasMaster = ref<boolean>();
const usage = ref({ used: 0, total: 0 });

const { open: openPasswordDialog } = useProgrammaticDialog(PasswordDialog, {
  action: "changeMaster",
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
    router.push({ name: "master-password-setup" });
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
  <Card data-master-password-settings>
    <CardHeader>
      <CardTitle>{{ t("wallet.masterPassword") }}</CardTitle>
      <CardDescription>{{ hasMaster === undefined ? "" : description }}</CardDescription>
      <CardAction v-if="hasMaster !== undefined && !canReset">
        <Button
          v-if="hasMaster"
          variant="outline"
          @click="openPasswordDialog({ action: 'changeMaster' })"
          >{{ t("common.change") }}</Button
        >
        <Button
          v-else
          variant="outline"
          :disabled="usage.total === 0"
          @click="router.push({ name: 'master-password-setup' })"
          >{{ t("settings.password.setUp") }}</Button
        >
      </CardAction>
    </CardHeader>

    <CardContent v-if="canReset" class="flex gap-2">
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
    </CardContent>
  </Card>
</template>
