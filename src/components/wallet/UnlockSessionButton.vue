<script setup lang="ts">
import { LockKeyholeIcon, LockKeyholeOpenIcon } from "@lucide/vue";
import { useI18n } from "vue-i18n";
import { useToast } from "@/components/ui/toast";
import { log } from "@/common/logger";
import { extractErrorMessage } from "@/common/utils";
import { useUnlockSession } from "@/composables/useUnlockSession";
import { walletsDbService } from "@/database/walletsDbService";
import ActionButton from "./ActionButton.vue";

/**
 * Shows whether the session is active, unlike the other action buttons, which show what
 * they do: a padlock reads as a status. `unlock` asks for the master password, with an
 * `UnlockSessionDialog` owned by the parent.
 */
const emit = defineEmits<{ (e: "unlock"): void }>();

const { t } = useI18n();
const { toast } = useToast();
const { active: unlocked, available } = useUnlockSession();

async function toggle() {
  if (!unlocked.value) {
    emit("unlock");
    return;
  }

  try {
    await walletsDbService.lock();
  } catch (e) {
    log.error(e);
    toast({ title: extractErrorMessage(e), variant: "destructive" });
  }
}
</script>

<template>
  <ActionButton
    v-if="available"
    data-unlock-session
    :label="unlocked ? t('wallet.lock') : t('wallet.unlock')"
    @click="toggle"
  >
    <LockKeyholeOpenIcon v-if="unlocked" />
    <LockKeyholeIcon v-else />
  </ActionButton>
</template>
