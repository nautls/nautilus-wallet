<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { isSystemLockSupported } from "@/common/browser";
import { log } from "@/common/logger";
import { extractErrorMessage } from "@/common/utils";
import { UNLOCK_TIMEOUTS, UnlockTimeout } from "@/database/unlockSession";
import { walletsDbService } from "@/database/walletsDbService";

const { t } = useI18n();
const { toast } = useToast();

const usesMaster = ref(false);
const selected = ref<UnlockTimeout>();
const saving = ref(false);

const options = UNLOCK_TIMEOUTS.filter((v) => v !== "systemLock" || isSystemLockSupported());

function label(timeout: UnlockTimeout): string {
  switch (timeout) {
    case "off":
      return t("settings.password.timeoutOff");
    case "systemLock":
      return t("settings.password.timeoutSystemLock");
    case "browserRestart":
      return t("settings.password.timeoutBrowserRestart");
  }

  const count = parseInt(timeout);
  return timeout.endsWith("h")
    ? t("settings.password.timeoutHours", count)
    : t("settings.password.timeoutMinutes", count);
}

onMounted(async () => {
  if (!walletsDbService.isUnlockSessionSupported()) return;

  const [usage, timeout] = await Promise.all([
    walletsDbService.getMasterPasswordUsage(),
    walletsDbService.getUnlockTimeout()
  ]);
  usesMaster.value = usage.used > 0;
  selected.value = timeout;
});

async function select(value: unknown) {
  const timeout = value as UnlockTimeout;
  saving.value = true;
  try {
    await walletsDbService.setUnlockTimeout(timeout);
    selected.value = timeout;
  } catch (e) {
    log.error(e);
    toast({ title: extractErrorMessage(e), variant: "destructive" });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Card v-if="usesMaster" class="px-4" data-unlock-session-settings>
    <Label for="unlock-session" class="flex flex-col items-start gap-2">
      {{ t("settings.password.unlockSession") }}
      <span class="text-muted-foreground text-xs font-normal">
        {{ t("settings.password.unlockSessionDesc") }}
      </span>
    </Label>

    <Select :model-value="selected" :disabled="saving" @update:model-value="select">
      <SelectTrigger id="unlock-session">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem v-for="option in options" :key="option" :value="option">
            {{ label(option) }}
          </SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  </Card>
</template>
