<script setup lang="ts">
import { nextTick, ref, useTemplateRef, watch } from "vue";
import { useRegle } from "@regle/core";
import { required, withMessage } from "@regle/rules";
import { CircleAlertIcon, Loader2Icon } from "@lucide/vue";
import { useI18n } from "vue-i18n";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from "@/components/ui/drawer";
import { Form, FormField } from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordError } from "@/common/errors";
import { log } from "@/common/logger";
import { extractErrorMessage } from "@/common/utils";
import { useWrongMasterPasswordRule } from "@/composables/usePasswordPrompt";
import { walletsDbService } from "@/database/walletsDbService";

const emit = defineEmits(["close"]);

const { t } = useI18n();

const opened = ref(true);
const loading = ref(false);
const failure = ref<string>();
const password = ref("");
const pwdInput = useTemplateRef("pwd-input");

const wrongPassword = useWrongMasterPasswordRule(password);

const { r$ } = useRegle(
  { password },
  {
    password: {
      required: withMessage(required, () => t("wallet.masterPasswordRequired")),
      correct: wrongPassword.correct
    }
  },
  { autoDirty: false }
);

async function unlock() {
  if (!(await r$.$validate()).valid) return;

  try {
    loading.value = true;
    failure.value = undefined;
    await walletsDbService.unlock(password.value);
    setOpened(false);
  } catch (e) {
    if (e instanceof PasswordError) {
      wrongPassword.markWrong();
      await r$.password.$validate();
      // a disabled input can't take focus, so re-enable it and wait for the render first
      loading.value = false;
      await nextTick();
      pwdInput.value?.input?.$el.focus();
      return;
    }

    log.error(e);
    failure.value = extractErrorMessage(e);
  } finally {
    loading.value = false;
  }
}

function reset() {
  password.value = "";
  failure.value = undefined;
  r$.$reset();
}

// clears on reopen too: the focused field blurs as the closed drawer unmounts, touching it again
watch(opened, reset);

function handleOpenUpdates(open: boolean) {
  if (!open) emit("close");
}

function setOpened(open: boolean) {
  opened.value = open;
}

defineExpose({ open: () => setOpened(true), close: () => setOpened(false) });
</script>

<template>
  <Drawer v-model:open="opened" :dismissible="!loading" @update:open="handleOpenUpdates">
    <DrawerContent :dismissible="!loading">
      <DrawerHeader>
        <DrawerTitle>{{ t("wallet.unlockTitle") }}</DrawerTitle>
        <DrawerDescription class="hyphens-auto">{{ t("wallet.unlockDesc") }}</DrawerDescription>
      </DrawerHeader>

      <Form @submit="unlock">
        <FormField :validation="r$.password">
          <Label for="unlock-password">{{ t("wallet.masterPassword") }}</Label>
          <PasswordInput
            id="unlock-password"
            ref="pwd-input"
            v-model="password"
            :disabled="loading"
            @blur="r$.password.$touch()"
          />
        </FormField>
      </Form>

      <Alert v-if="failure" id="unlock-error" variant="destructive">
        <CircleAlertIcon />
        <AlertTitle>{{ t("wallet.unlockFailed") }}</AlertTitle>
        <AlertDescription class="wrap-break-word">{{ failure }}</AlertDescription>
      </Alert>

      <DrawerFooter>
        <Button :disabled="loading" @click="unlock">
          <Loader2Icon v-if="loading" class="animate-spin" />
          {{ t("wallet.unlock") }}
        </Button>
      </DrawerFooter>
    </DrawerContent>
  </Drawer>
</template>
