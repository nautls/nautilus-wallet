<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
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
import { Switch } from "@/components/ui/switch";
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
const sessionEnabled = ref(false);

const { open: openPasswordDialog } = useProgrammaticDialog(PasswordDialog, {
  action: "changeMaster",
  onDone: load
});

onMounted(load);

async function load() {
  [hasMaster.value, usage.value, sessionEnabled.value] = await Promise.all([
    walletsDbService.hasMasterPassword(),
    walletsDbService.getMasterPasswordUsage(),
    walletsDbService.isUnlockSessionEnabled()
  ]);
}

async function setSessionEnabled(enabled: boolean) {
  sessionEnabled.value = enabled;
  try {
    await walletsDbService.setUnlockSessionEnabled(enabled);
  } catch (e) {
    log.error(e);
    sessionEnabled.value = !enabled;
    toast({ title: extractErrorMessage(e), variant: "destructive" });
  }
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
        <Button
          v-else
          variant="outline"
          :disabled="usage.total === 0"
          @click="router.push({ name: 'master-password-setup' })"
          >{{ t("settings.password.setUp") }}</Button
        >
      </template>
    </div>

    <div
      v-if="hasMaster && usage.used > 0 && walletsDbService.isUnlockSessionSupported()"
      class="flex items-center justify-between gap-4"
    >
      <Label for="unlock-session" class="flex flex-col items-start gap-1">
        {{ t("settings.password.unlockSession") }}
        <span class="text-muted-foreground text-xs font-normal">
          {{ t("settings.password.unlockSessionDesc") }}
        </span>
      </Label>
      <Switch
        id="unlock-session"
        :model-value="sessionEnabled"
        @update:model-value="setSessionEnabled"
      />
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
